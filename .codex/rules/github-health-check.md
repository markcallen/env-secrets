# GitHub Repository Health Check Skill

Runs a comprehensive health audit of the current GitHub repository using the `gh` CLI. Produces a structured report with status indicators and actionable items. Auto-merges safe Dependabot PRs.

---

## Prerequisites

```bash
# Verify gh is authenticated and repo context is available
gh auth status
gh repo view --json name,owner,defaultBranchRef
```

Capture the repo owner and name for use in API calls:

```bash
REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
OWNER=$(gh repo view --json owner --jq '.owner.login')
NAME=$(gh repo view --json name --jq '.name')
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')
```

---

## Check 1 — GitHub Actions Status (default branch)

```bash
# Recent workflow runs on the default branch
gh run list --branch "$DEFAULT_BRANCH" --limit 20 \
  --json status,conclusion,name,workflowName,createdAt,url \
  --jq '.[] | {workflow: .workflowName, status: .status, conclusion: .conclusion, created: .createdAt, url: .url}'
```

**Interpret results:**

- Group runs by workflow name; show the latest run per workflow
- Flag any workflow whose latest run concluded with `failure` or `cancelled`
- Flag workflows that haven't run in more than 14 days
- Show overall summary: X workflows passing, Y failing

```bash
# Check for any in-progress or queued runs
gh run list --branch "$DEFAULT_BRANCH" --status in_progress --json workflowName,url
gh run list --branch "$DEFAULT_BRANCH" --status queued --json workflowName,url
```

---

## Check 2 — Branch Freshness vs Latest Release

```bash
# Get the latest release tag
LATEST_TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName // "none"')
echo "Latest release: $LATEST_TAG"

# Count commits on default branch since last release
if [ "$LATEST_TAG" != "none" ]; then
  git fetch --tags 2>/dev/null || true
  COMMITS_AHEAD=$(git rev-list "${LATEST_TAG}..HEAD" --count 2>/dev/null || echo "unknown")
  echo "Commits since last release: $COMMITS_AHEAD"

  # Show recent unreleased commits
  git log "${LATEST_TAG}..HEAD" --oneline 2>/dev/null | head -10 || true
fi

# Get last release date
gh release list --limit 1 --json tagName,publishedAt \
  --jq '.[] | "Tag: \(.tagName)  Published: \(.publishedAt)"'
```

**Interpret results:**

- If commits ahead > 20: warn that a release may be overdue
- If last release was more than 30 days ago: note it
- If no releases exist: note that versioned releases are not configured

---

## Check 3 — Open Pull Requests

```bash
# List all open PRs with key metadata
gh pr list --state open --json number,title,author,isDraft,createdAt,labels,headRefName,reviewDecision,statusCheckRollup \
  --jq '.[] | {
    number: .number,
    title: .title,
    author: .author.login,
    isDraft: .isDraft,
    created: .createdAt,
    branch: .headRefName,
    review: .reviewDecision,
    checks: (.statusCheckRollup // [] | {
      total: length,
      passing: map(select(.conclusion == "SUCCESS")) | length,
      failing: map(select(.conclusion == "FAILURE")) | length
    })
  }'
```

**Report:**

- Total open PRs, draft vs ready
- PRs older than 7 days without activity (stale)
- PRs with failing checks
- PRs awaiting review

### Dependabot PR Auto-Merge

```bash
# Get all open Dependabot PRs
gh pr list --state open --author "app/dependabot" \
  --json number,title,headRefName,statusCheckRollup,isDraft,mergeable
```

For each Dependabot PR returned, apply this decision logic:

1. **Parse the version bump** from the PR title (format: "Bump X from A.B.C to D.E.F"):

   - Extract `from` version and `to` version
   - Compare the major version (first number): if major version changes → **SKIP** (major upgrade)
   - If only minor/patch changes → candidate for auto-merge

2. **Check CI status**: all checks must be `SUCCESS` (no failures, no pending)

   ```bash
   gh pr checks <PR_NUMBER> --json name,state,conclusion
   ```

3. **Verify not a draft** and **mergeable** state is not `CONFLICTING`

4. **Auto-merge if all conditions pass** (no confirmation needed):

   ```bash
   gh pr merge <PR_NUMBER> --squash --auto
   ```

5. **Report each decision**: merged / skipped (major) / skipped (CI failing) / skipped (conflicts)

**Example major version detection:**

- "Bump eslint from 8.57.0 to 9.0.0" → major (8→9) → SKIP
- "Bump typescript from 5.3.3 to 5.4.0" → minor → merge
- "Bump lodash from 4.17.20 to 4.17.21" → patch → merge

---

## Check 4 — Code Coverage (Codecov)

```bash
# Check for codecov configuration file
ls .codecov.yml codecov.yml .codecov.yaml codecov.yaml 2>/dev/null || echo "No codecov config file found"

# Check for codecov in CI workflows
grep -rl "codecov" .github/workflows/ 2>/dev/null || echo "No codecov step found in workflows"

# Check README for codecov badge
grep -i "codecov" README.md 2>/dev/null | head -3 || echo "No codecov badge in README"

# Check if codecov token is configured as a repo secret (presence only, not value)
gh api "/repos/${OWNER}/${NAME}/actions/secrets" --jq '.secrets[].name' 2>/dev/null | grep -i codecov || echo "No CODECOV secret found"
```

**Interpret results:**

- If no codecov config AND no codecov in workflows AND no badge: **WARN** — Codecov does not appear to be configured. Recommend adding the `codecov/codecov-action` to CI workflows.
- If present: confirm coverage reporting is active

---

## Check 5 — GitHub Code Quality

```bash
# Try the direct repo feature status first. GitHub may not expose this field
# yet for all plans / repos / API versions, so treat missing data as inconclusive.
if code_quality_status="$(gh api "/repos/${OWNER}/${NAME}" \
  --jq '.security_and_analysis.code_quality.status // "not_exposed"' 2>/dev/null)" \
  && [ -n "$code_quality_status" ]; then
  echo "Code Quality API status: $code_quality_status"
else
  echo "Code Quality API status: unavailable"
fi

# Look for the dynamic workflow GitHub creates when Code Quality is enabled.
gh run list --workflow "Code Quality" --limit 10 \
  --json status,conclusion,createdAt,url \
  --jq '.[] | {status, conclusion, createdAt, url}' 2>/dev/null || true

# Look for repository comments from the Code Quality bot on pull requests.
gh api "/repos/${OWNER}/${NAME}/issues/comments?per_page=100" \
  --jq '.[] | select(.user.login == "github-code-quality[bot]") |
    {createdAt: .created_at, url: .html_url}' 2>/dev/null || true
```

**Interpret results:**

- If `security_and_analysis.code_quality.status` is `enabled`: report GitHub Code Quality as enabled
- If the direct field is not exposed, infer likely enabled when recent `Code Quality` workflow runs or `github-code-quality[bot]` comments exist
- If neither the direct field nor fallback signals are present: report Code Quality as not detected and recommend verifying `Settings` → `Security` → `Code quality`
- Note that GitHub Code Quality is currently in public preview and its API surface may be incomplete or absent for some repositories

### Code Quality Findings

```bash
# List recent Code Quality check runs and annotations when exposed through Checks.
HEAD_SHA=$(gh api "/repos/${OWNER}/${NAME}/commits/${DEFAULT_BRANCH}" --jq '.sha' 2>/dev/null || git rev-parse HEAD)
gh api "/repos/${OWNER}/${NAME}/commits/${HEAD_SHA}/check-runs?per_page=100" \
  --jq '.check_runs[] | select((.name | ascii_downcase | contains("code quality")) or (.app.slug == "github-code-quality")) |
    {id, name, status, conclusion, url: .html_url}' 2>/dev/null || true

for check_id in $(gh api "/repos/${OWNER}/${NAME}/commits/${HEAD_SHA}/check-runs?per_page=100" \
  --jq '.check_runs[] | select((.name | ascii_downcase | contains("code quality")) or (.app.slug == "github-code-quality")) | .id' 2>/dev/null); do
  gh api "/repos/${OWNER}/${NAME}/check-runs/${check_id}/annotations?per_page=100" \
    --jq '.[] | {
      level: .annotation_level,
      path,
      start_line,
      end_line,
      title,
      message,
      raw_details
    }' 2>/dev/null || true
done

# Fallback: list recent Code Quality bot comments on PRs.
gh api "/repos/${OWNER}/${NAME}/issues/comments?per_page=100" \
  --jq '.[] | select(.user.login == "github-code-quality[bot]") |
    {createdAt: .created_at, issueUrl: .issue_url, body: (.body | split("\n") | .[0:6] | join("\n")), url: .html_url}' 2>/dev/null || true
```

**Interpret results:**

- List every exposed Code Quality finding with level, file, line, title/message, and URL
- If only bot comments are available, summarize the referenced PR and include the comment URL
- If findings cannot be listed because GitHub does not expose the data, report the feature status separately from findings visibility

---

## Check 6 — GitHub Security Feature Enablement

Check whether required repository security features are enabled and assign the requested priority when they are missing.

```bash
# Repo visibility and security/security-and-analysis settings.
gh repo view --json isPrivate,visibility,nameWithOwner \
  --jq '"Repo: \(.nameWithOwner)\nVisibility: \(.visibility)\nPrivate: \(.isPrivate)"'

IS_PRIVATE=$(gh repo view --json isPrivate --jq '.isPrivate')

gh api "/repos/${OWNER}/${NAME}" \
  --jq '.security_and_analysis // {}' 2>/dev/null || \
  echo "Security and analysis settings unavailable (check permissions or plan)"

# Security policy: SECURITY.md in repo, .github profile, or community profile metadata.
if [ -f SECURITY.md ] || [ -f .github/SECURITY.md ]; then
  echo "Security policy file present locally"
else
  echo "Security policy file not found locally"
fi
gh api "/repos/${OWNER}/${NAME}/community/profile" \
  --jq '.files.security_policy | if . then {state: "present", path: .path, url: .html_url} else {state: "missing"} end' 2>/dev/null || true

# Repository security advisories capability and current advisories.
gh api "/repos/${OWNER}/${NAME}/security-advisories?per_page=100" \
  --jq '{accessible: true, total: length, advisories: [.[] | {ghsa_id, severity, state, summary, url: .html_url}]}' 2>/dev/null || \
  echo "Security advisories API unavailable (may require admin/security manager access)"

# Private vulnerability reporting is expected only for public repos.
if [ "$IS_PRIVATE" = "false" ]; then
  PVR_RESPONSE=$(gh api --include "/repos/${OWNER}/${NAME}/private-vulnerability-reporting" 2>&1 || true)
  PVR_STATUS=$(printf '%s\n' "$PVR_RESPONSE" | sed -n 's/^HTTP\/[0-9.]* \([0-9][0-9][0-9]\).*/\1/p' | tail -n 1)
  case "$PVR_STATUS" in
    200|204)
      echo '{"enabled": true}'
      ;;
    404)
      echo '{"enabled": false}'
      ;;
    403)
      echo "Private vulnerability reporting status unavailable (permission denied)"
      ;;
    *)
      echo "Private vulnerability reporting status unavailable"
      ;;
  esac
else
  echo "Private vulnerability reporting: not required for private repositories"
fi
```

**Required enablement priorities:**

- `HIGH`: Security advisories must be available for maintainers/security managers and open advisories must be listed
- `HIGH`: Private vulnerability reporting must be enabled for public repositories only
- `HIGH`: Dependabot alerts must be enabled and queryable
- `HIGH`: Code scanning alerts must be enabled and queryable
- `HIGH`: Secret scanning alerts must be enabled and queryable
- `MEDIUM`: A security policy must exist and be discoverable through `SECURITY.md` or GitHub community profile metadata
- `MEDIUM`: GitHub Code Quality should be enabled or verified manually when the API does not expose its status

**Interpret results:**

- Missing `HIGH` controls go in Recommended Actions as `HIGH`
- Missing `MEDIUM` controls go in Recommended Actions as `MEDIUM`
- For public repos, treat missing private vulnerability reporting as `HIGH`; for private repos, report it as not applicable
- When an API returns 403/404, distinguish "not enabled" from "not enough permission" whenever the response makes that clear

---

## Check 7 — Security Alerts and Findings

```bash
# Dependabot alerts: list malware separately from vulnerabilities.
echo "--- Dependabot malware alerts ---"
gh api "/repos/${OWNER}/${NAME}/dependabot/alerts?state=open&per_page=100" \
  --jq '.[] |
    select(((.security_advisory.cwes // []) | map(.cwe_id) | join(" ") | ascii_downcase | contains("malware")) or
      (.security_advisory.summary | ascii_downcase | contains("malware")) or
      (.security_advisory.description // "" | ascii_downcase | contains("malware"))) |
    {
      number,
      severity: .security_advisory.severity,
      package: .dependency.package.name,
      ecosystem: .dependency.package.ecosystem,
      manifest: .dependency.manifest_path,
      summary: .security_advisory.summary,
      ghsa_id: .security_advisory.ghsa_id,
      url: .html_url
    }' 2>/dev/null || true

echo "--- Dependabot vulnerability alerts ---"
gh api "/repos/${OWNER}/${NAME}/dependabot/alerts?state=open&per_page=100" \
  --jq '.[] |
    select((((.security_advisory.cwes // []) | map(.cwe_id) | join(" ") | ascii_downcase | contains("malware")) or
      (.security_advisory.summary | ascii_downcase | contains("malware")) or
      (.security_advisory.description // "" | ascii_downcase | contains("malware"))) | not) |
    {
      number,
      severity: .security_advisory.severity,
      package: .dependency.package.name,
      ecosystem: .dependency.package.ecosystem,
      manifest: .dependency.manifest_path,
      vulnerable_range: .security_vulnerability.vulnerable_version_range,
      patched_versions: .security_vulnerability.first_patched_version.identifier,
      summary: .security_advisory.summary,
      ghsa_id: .security_advisory.ghsa_id,
      url: .html_url
    }' 2>/dev/null || true

# Count open Dependabot security alerts.
gh api "/repos/${OWNER}/${NAME}/dependabot/alerts?state=open&per_page=100" \
  --jq 'length' 2>/dev/null | xargs -I{} echo "Open Dependabot alerts: {}" || \
  echo "Could not fetch Dependabot alert count (check repo permissions)"

# Show top severity alerts
gh api "/repos/${OWNER}/${NAME}/dependabot/alerts?state=open&sort=severity&direction=desc&per_page=10" \
  --jq '.[] | "[\(.security_advisory.severity | ascii_upcase)] \(.security_advisory.summary) — \(.dependency.package.name)"' 2>/dev/null || true

# Code scanning alerts (SAST / CodeQL): list all open alerts.
gh api "/repos/${OWNER}/${NAME}/code-scanning/alerts?state=open&per_page=100" \
  --jq 'length' 2>/dev/null | xargs -I{} echo "Open code scanning alerts: {}" || \
  echo "Code scanning: not enabled or no access"

gh api "/repos/${OWNER}/${NAME}/code-scanning/alerts?state=open&per_page=100" \
  --jq '.[] | {
    number,
    severity: (.rule.security_severity_level // .rule.severity // "unknown"),
    tool: .tool.name,
    rule: .rule.id,
    description: .rule.description,
    path: .most_recent_instance.location.path,
    start_line: .most_recent_instance.location.start_line,
    state,
    url: .html_url
  }' 2>/dev/null || true

# Secret scanning alerts: list all open alerts.
gh api "/repos/${OWNER}/${NAME}/secret-scanning/alerts?state=open&per_page=100" \
  --jq 'length' 2>/dev/null | xargs -I{} echo "Open secret scanning alerts: {}" || \
  echo "Secret scanning: not enabled or no access"

gh api "/repos/${OWNER}/${NAME}/secret-scanning/alerts?state=open&per_page=100" \
  --jq '.[] | {
    number,
    secret_type,
    secret_type_display_name,
    state,
    resolution,
    created_at,
    url: .html_url
  }' 2>/dev/null || true
```

**Interpret results:**

- Open Dependabot malware alerts > 0: list them separately and prioritize as `CRITICAL`
- Open Dependabot vulnerability alerts > 0: list them with severity, package, ecosystem, manifest, patched version, and URL
- Code scanning alerts: list every open alert with severity, rule, file, line, and URL; critical/high items are `HIGH`
- Secret scanning alerts > 0: list every open alert and flag as `CRITICAL` because leaked secrets need immediate rotation
- If code scanning is not enabled: recommend enabling CodeQL or another code scanning tool in GitHub security settings

---

## Check 8 — Snyk Integration

```bash
# Check for .snyk policy file
ls .snyk 2>/dev/null && echo "Snyk policy file found: .snyk" || echo "No .snyk file"

# Check CI workflows for Snyk
grep -rl "snyk" .github/workflows/ 2>/dev/null || echo "No Snyk step found in workflows"

# Check README for Snyk badge
grep -i "snyk" README.md 2>/dev/null | head -3 || echo "No Snyk badge in README"

# Check for snyk-related secrets
gh api "/repos/${OWNER}/${NAME}/actions/secrets" --jq '.secrets[].name' 2>/dev/null | grep -i snyk || echo "No SNYK secret found"
```

**Interpret results:**

- If no `.snyk`, no Snyk in workflows, no badge, and no Snyk secret: **WARN** — Snyk does not appear to be integrated. Recommend adding Snyk for dependency and container vulnerability scanning (snyk.io).
- If partially configured: note what's present and what's missing

---

## Check 9 — Branch Protection Rules

```bash
# Check protection rules on the default branch
gh api "/repos/${OWNER}/${NAME}/branches/${DEFAULT_BRANCH}/protection" 2>/dev/null || \
  echo "WARNING: No branch protection rules found on ${DEFAULT_BRANCH}"

# Parse and summarize key protections
gh api "/repos/${OWNER}/${NAME}/branches/${DEFAULT_BRANCH}/protection" 2>/dev/null | \
  python3 -c "
import sys, json
try:
    p = json.load(sys.stdin)
    good, bad = [], []
    if p.get('required_pull_request_reviews'): good.append('PR reviews required')
    else: bad.append('No required PR reviews')
    if p.get('required_status_checks'): good.append('Status checks required')
    else: bad.append('No required status checks')
    if p.get('enforce_admins', {}).get('enabled'): good.append('Rules enforced for admins')
    if p.get('allow_force_pushes', {}).get('enabled'): bad.append('Force pushes allowed on main')
    if p.get('allow_deletions', {}).get('enabled'): bad.append('Branch deletion allowed')
    for g in good: print('OK:', g)
    for b in bad: print('WARN:', b)
except Exception as e: print('Could not parse:', e)
" 2>/dev/null || true
```

**Flag missing protections:**

- No required PR reviews: warn
- No required status checks: warn
- Force pushes allowed on main: warn
- No branch protection at all: flag as high priority

---

## Check 10 — Stale Branches

```bash
# List remote branches not merged to default branch, sorted by last commit date
git fetch --prune 2>/dev/null || true
git branch -r --no-merged "origin/${DEFAULT_BRANCH}" \
  --sort=-committerdate \
  --format='%(committerdate:relative)|%(refname:short)' 2>/dev/null | \
  grep -v "HEAD\|${DEFAULT_BRANCH}" | head -20

# Count stale branches (no commits in 30+ days, not yet merged)
STALE_COUNT=$(git branch -r --no-merged "origin/${DEFAULT_BRANCH}" \
  --format='%(committerdate:unix)|%(refname:short)' 2>/dev/null | \
  python3 -c "
import sys
from datetime import datetime, timezone
cutoff = datetime.now(timezone.utc).timestamp() - 30 * 86400
count = 0
for line in sys.stdin:
    parts = line.strip().split('|')
    if len(parts) == 2 and parts[0].isdigit() and int(parts[0]) < cutoff:
        count += 1
print(count)
" 2>/dev/null || echo "0")
echo "Stale branches (30+ days, unmerged): $STALE_COUNT"
```

---

## Check 11 — Repository Housekeeping

```bash
# Check for essential files
for f in README.md LICENSE .gitignore .github/dependabot.yml SECURITY.md .github/CODEOWNERS CODEOWNERS; do
  [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"
done

# Dependabot config check
if [ -f ".github/dependabot.yml" ]; then
  echo "Dependabot ecosystems configured:"
  grep "package-ecosystem" .github/dependabot.yml | sort | uniq -c
else
  echo "WARNING: No .github/dependabot.yml — automated dependency updates not configured"
fi

# Check repo has a description and topics
gh repo view --json description,repositoryTopics \
  --jq '"Description: \(.description // "MISSING — add in repo settings")\nTopics: \(.repositoryTopics.nodes | map(.topic.name) | join(", ") | if . == "" then "NONE — add topics for discoverability" else . end)"'
```

---

## Check 12 — Workflow Health Patterns

```bash
# Detect consistently failing workflows (>50% failure rate over recent runs)
gh run list --branch "$DEFAULT_BRANCH" --limit 50 \
  --json workflowName,conclusion,createdAt \
  --jq 'group_by(.workflowName) | .[] | {
    workflow: .[0].workflowName,
    runs: length,
    failures: map(select(.conclusion == "failure")) | length
  } | select(.runs >= 3) |
  "\(.workflow): \(.failures)/\(.runs) recent runs failed\(if (.failures / .runs) > 0.5 then " CONSISTENTLY FAILING" else "" end)"'
```

---

## Check 13 — Release & Tag Health

```bash
# List recent releases
gh release list --limit 5 --json tagName,publishedAt,isDraft,isPrerelease \
  --jq '.[] | "\(.tagName) [\(if .isDraft then "DRAFT" elif .isPrerelease then "PRE-RELEASE" else "RELEASED" end)] — \(.publishedAt)"'

# Check for unpublished draft releases
DRAFT_COUNT=$(gh release list --json isDraft --jq '[.[] | select(.isDraft)] | length' 2>/dev/null || echo "0")
[ "$DRAFT_COUNT" -gt 0 ] && echo "WARNING: $DRAFT_COUNT unpublished draft release(s)" || true
```

---

## Check 14 — Actions Permissions & Secrets Health

```bash
# Check default workflow permissions
gh api "/repos/${OWNER}/${NAME}/actions/permissions" \
  --jq '"Actions enabled: \(.enabled)\nDefault permission: \(.default_workflow_permissions // "unknown")"' 2>/dev/null

# List repo secret names and ages (values never shown)
echo "--- Repository Secrets ---"
gh api "/repos/${OWNER}/${NAME}/actions/secrets" \
  --jq '.secrets[] | "\(.name) (last updated: \(.updated_at))"' 2>/dev/null

# Warn about secrets not rotated in 180+ days
gh api "/repos/${OWNER}/${NAME}/actions/secrets" 2>/dev/null | \
  python3 -c "
import sys, json
from datetime import datetime, timezone
try:
    data = json.load(sys.stdin)
    for s in data.get('secrets', []):
        updated = s.get('updated_at', '')
        try:
            dt = datetime.fromisoformat(updated.replace('Z', '+00:00'))
            age = (datetime.now(timezone.utc) - dt).days
            if age > 180:
                print(f'STALE SECRET ({age} days): {s[\"name\"]} — consider rotating')
        except: pass
except: pass
" 2>/dev/null || true
```

---

## Check 15 — Public and Private Repository Best Practices

Run these additional checks after determining repo visibility.

```bash
# Repository settings that affect public/private repo hygiene.
gh repo view --json \
  nameWithOwner,visibility,isPrivate,isArchived,hasIssuesEnabled,hasProjectsEnabled,hasWikiEnabled,description,homepageUrl,repositoryTopics,licenseInfo,defaultBranchRef \
  --jq '{
    repo: .nameWithOwner,
    visibility,
    isPrivate,
    archived: .isArchived,
    issues: .hasIssuesEnabled,
    projects: .hasProjectsEnabled,
    wiki: .hasWikiEnabled,
    description,
    homepage: .homepageUrl,
    topics: [.repositoryTopics.nodes[].topic.name],
    license: .licenseInfo.spdxId,
    defaultBranch: .defaultBranchRef.name
  }'

# Rulesets can supplement or replace classic branch protection.
gh api "/repos/${OWNER}/${NAME}/rulesets?per_page=100" \
  --jq '.[] | {name, target, enforcement, conditions, rules: [.rules[].type]}' 2>/dev/null || \
  echo "Rulesets unavailable or not configured"

# Collaborators and external access. Requires admin permissions on many repos.
gh api "/repos/${OWNER}/${NAME}/collaborators?affiliation=outside&per_page=100" \
  --jq '.[] | {login, permissions}' 2>/dev/null || \
  echo "Outside collaborators unavailable (check permissions) or none found"

# Pull request templates and issue templates.
for f in .github/pull_request_template.md .github/PULL_REQUEST_TEMPLATE.md; do
  [ -f "$f" ] && echo "OK: $f" || true
done
[ -d .github/ISSUE_TEMPLATE ] && find .github/ISSUE_TEMPLATE -maxdepth 1 -type f -print || echo "No issue templates found"

# GitHub Actions supply-chain hygiene: flag unpinned third-party actions.
grep -RhoE 'uses: +[^ ]+' .github/workflows 2>/dev/null | \
  sed 's/uses: *//' | \
  grep -vE '^\\./|@[0-9a-f]{40}$' || \
  echo "No obviously unpinned third-party actions found"
```

**Public repo best-practice checks:**

- `HIGH`: Private vulnerability reporting enabled
- `HIGH`: Secret scanning and push protection enabled
- `HIGH`: Dependabot alerts and security updates enabled
- `HIGH`: Code scanning enabled on the default branch
- `MEDIUM`: `SECURITY.md`, `LICENSE`, README, description, and topics are present
- `MEDIUM`: Branch protection or rulesets require reviews and status checks before merge
- `MEDIUM`: CODEOWNERS and PR templates exist for maintainability
- `MEDIUM`: Third-party GitHub Actions are pinned to full commit SHAs or justified

**Private repo best-practice checks:**

- `HIGH`: Secret scanning and push protection enabled where the plan supports it
- `HIGH`: Dependabot alerts and security updates enabled
- `HIGH`: Code scanning enabled where GitHub Advanced Security or equivalent tooling is available
- `HIGH`: Outside collaborators are reviewed and least-privilege
- `MEDIUM`: Branch protection or rulesets require reviews and status checks before merge
- `MEDIUM`: Actions default workflow permissions are read-only unless write is justified
- `MEDIUM`: Stale secrets are rotated and unused secrets are removed
- `MEDIUM`: CODEOWNERS, PR templates, and issue templates exist where useful for the team

---

## Generate Health Report

After running all checks, present findings in this structure:

```text

## GitHub Repository Health Report
**Repo**: owner/name
**Date**: <today>
**Default Branch**: main

---
### Overall Status: [HEALTHY | NEEDS ATTENTION | CRITICAL]

---
### CI/CD  ✅/⚠️/❌
| Workflow | Latest Status | Last Run |
|----------|--------------|----------|
| ...      | ✅/❌        | ...      |

---
### Pull Requests
- Open PRs: N (D draft, R ready for review)
- Stale PRs (>7 days, no activity): N
- Dependabot PRs auto-merged: N (list titles)
- Dependabot PRs skipped: N (list with reason)

---
### Security  ✅/⚠️/❌
- Dependabot alerts: N open (X critical, Y high)
- Code scanning (CodeQL): enabled/NOT ENABLED
- Secret scanning: N open alerts
- Snyk: configured / NOT CONFIGURED ⚠️
- Branch protection on main: summary of rules

---
### Code Coverage  ✅/⚠️
- Codecov: configured / NOT CONFIGURED ⚠️

---
### Repository Housekeeping  ✅/⚠️
- Missing essential files: list or "none"
- Dependabot auto-updates: configured / missing
- Stale unmerged branches: N
- Draft releases: N

---
### Recommended Actions (prioritized)
1. [CRITICAL] ...
2. [HIGH] ...
3. [MEDIUM] ...
4. [LOW/NICE-TO-HAVE] ...
```

---

## Edge Cases

- **Private repo without security features**: Some APIs require admin access; note when commands fail with 403/404 and suggest the user checks repo settings manually
- **Org-managed repos**: Branch protection and secrets may be inherited from org settings; note this if the API returns 403
- **No releases yet**: Skip release freshness checks; note that versioned releases are not configured
- **Rate limiting**: If `gh` returns 429, note that data may be incomplete and suggest retrying
- **Monorepo**: If multiple `package.json` / `go.mod` / `pyproject.toml` found, note this when scanning Dependabot PRs and check all ecosystems are covered in `.github/dependabot.yml`
- **gh not authenticated**: Exit immediately with instructions: run `gh auth login`
- **No open PRs**: Confirm the repo is clean; no merging needed

## Check 5 — Security Alerts

```bash
# Count open Dependabot security alerts
gh api "/repos/${OWNER}/${NAME}/dependabot/alerts?state=open&per_page=100" \
  --jq 'length' 2>/dev/null | xargs -I{} echo "Open Dependabot alerts: {}" || \
  echo "Could not fetch Dependabot alert count (check repo permissions)"

# Show top severity alerts
gh api "/repos/${OWNER}/${NAME}/dependabot/alerts?state=open&sort=severity&direction=desc&per_page=10" \
  --jq '.[] | "[\(.security_advisory.severity | ascii_upcase)] \(.security_advisory.summary) — \(.dependency.package.name)"' 2>/dev/null || true

# Code scanning alerts (SAST / CodeQL)
gh api "/repos/${OWNER}/${NAME}/code-scanning/alerts?state=open&per_page=100" \
  --jq 'length' 2>/dev/null | xargs -I{} echo "Open code scanning alerts: {}" || \
  echo "Code scanning: not enabled or no access"

# Secret scanning alerts
gh api "/repos/${OWNER}/${NAME}/secret-scanning/alerts?state=open&per_page=100" \
  --jq 'length' 2>/dev/null | xargs -I{} echo "Open secret scanning alerts: {}" || \
  echo "Secret scanning: not enabled or no access"
```

**Interpret results:**

- Open Dependabot security alerts > 0: list them with severity (critical/high first)
- Code scanning alerts: show count and any critical/high items
- Secret scanning alerts > 0: flag as **CRITICAL** — leaked secrets need immediate rotation
- If code scanning is not enabled: recommend enabling CodeQL in GitHub Advanced Security

---

## Check 6 — Snyk Integration

```bash
# Check for .snyk policy file
ls .snyk 2>/dev/null && echo "Snyk policy file found: .snyk" || echo "No .snyk file"

# Check CI workflows for Snyk
grep -rl "snyk" .github/workflows/ 2>/dev/null || echo "No Snyk step found in workflows"

# Check README for Snyk badge
grep -i "snyk" README.md 2>/dev/null | head -3 || echo "No Snyk badge in README"

# Check for snyk-related secrets
gh api "/repos/${OWNER}/${NAME}/actions/secrets" --jq '.secrets[].name' 2>/dev/null | grep -i snyk || echo "No SNYK secret found"
```

**Interpret results:**

- If no `.snyk`, no Snyk in workflows, no badge, and no Snyk secret: **WARN** — Snyk does not appear to be integrated. Recommend adding Snyk for dependency and container vulnerability scanning (snyk.io).
- If partially configured: note what's present and what's missing

---

## Check 7 — Branch Protection Rules

```bash
# Check protection rules on the default branch
gh api "/repos/${OWNER}/${NAME}/branches/${DEFAULT_BRANCH}/protection" 2>/dev/null || \
  echo "WARNING: No branch protection rules found on ${DEFAULT_BRANCH}"

# Parse and summarize key protections
gh api "/repos/${OWNER}/${NAME}/branches/${DEFAULT_BRANCH}/protection" 2>/dev/null | \
  python3 -c "
import sys, json
try:
    p = json.load(sys.stdin)
    good, bad = [], []
    if p.get('required_pull_request_reviews'): good.append('PR reviews required')
    else: bad.append('No required PR reviews')
    if p.get('required_status_checks'): good.append('Status checks required')
    else: bad.append('No required status checks')
    if p.get('enforce_admins', {}).get('enabled'): good.append('Rules enforced for admins')
    if p.get('allow_force_pushes', {}).get('enabled'): bad.append('Force pushes allowed on main')
    if p.get('allow_deletions', {}).get('enabled'): bad.append('Branch deletion allowed')
    for g in good: print('OK:', g)
    for b in bad: print('WARN:', b)
except Exception as e: print('Could not parse:', e)
" 2>/dev/null || true
```

**Flag missing protections:**

- No required PR reviews: warn
- No required status checks: warn
- Force pushes allowed on main: warn
- No branch protection at all: flag as high priority

---

## Check 8 — Stale Branches

```bash
# List remote branches not merged to default branch, sorted by last commit date
git fetch --prune 2>/dev/null || true
git branch -r --no-merged "origin/${DEFAULT_BRANCH}" \
  --sort=-committerdate \
  --format='%(committerdate:relative)|%(refname:short)' 2>/dev/null | \
  grep -v "HEAD\|${DEFAULT_BRANCH}" | head -20

# Count stale branches (no commits in 30+ days, not yet merged)
STALE_COUNT=$(git branch -r --no-merged "origin/${DEFAULT_BRANCH}" \
  --format='%(committerdate:unix)|%(refname:short)' 2>/dev/null | \
  python3 -c "
import sys
from datetime import datetime, timezone
cutoff = datetime.now(timezone.utc).timestamp() - 30 * 86400
count = 0
for line in sys.stdin:
    parts = line.strip().split('|')
    if len(parts) == 2 and parts[0].isdigit() and int(parts[0]) < cutoff:
        count += 1
print(count)
" 2>/dev/null || echo "0")
echo "Stale branches (30+ days, unmerged): $STALE_COUNT"
```

---

## Check 9 — Repository Housekeeping

```bash
# Check for essential files
for f in README.md LICENSE .gitignore .github/dependabot.yml SECURITY.md .github/CODEOWNERS CODEOWNERS; do
  [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"
done

# Dependabot config check
if [ -f ".github/dependabot.yml" ]; then
  echo "Dependabot ecosystems configured:"
  grep "package-ecosystem" .github/dependabot.yml | sort | uniq -c
else
  echo "WARNING: No .github/dependabot.yml — automated dependency updates not configured"
fi

# Check repo has a description and topics
gh repo view --json description,repositoryTopics \
  --jq '"Description: \(.description // "MISSING — add in repo settings")\nTopics: \(.repositoryTopics.nodes | map(.topic.name) | join(", ") | if . == "" then "NONE — add topics for discoverability" else . end)"'
```

---

## Check 10 — Workflow Health Patterns

```bash
# Detect consistently failing workflows (>50% failure rate over recent runs)
gh run list --branch "$DEFAULT_BRANCH" --limit 50 \
  --json workflowName,conclusion,createdAt \
  --jq 'group_by(.workflowName) | .[] | {
    workflow: .[0].workflowName,
    runs: length,
    failures: map(select(.conclusion == "failure")) | length
  } | select(.runs >= 3) |
  "\(.workflow): \(.failures)/\(.runs) recent runs failed\(if (.failures / .runs) > 0.5 then " ⚠️ CONSISTENTLY FAILING" else "" end)"'
```

---

## Check 11 — Release & Tag Health

```bash
# List recent releases
gh release list --limit 5 --json tagName,publishedAt,isDraft,isPrerelease \
  --jq '.[] | "\(.tagName) [\(if .isDraft then "DRAFT" elif .isPrerelease then "PRE-RELEASE" else "RELEASED" end)] — \(.publishedAt)"'

# Check for unpublished draft releases
DRAFT_COUNT=$(gh release list --json isDraft --jq '[.[] | select(.isDraft)] | length' 2>/dev/null || echo "0")
[ "$DRAFT_COUNT" -gt 0 ] && echo "WARNING: $DRAFT_COUNT unpublished draft release(s)" || true
```

---

## Check 12 — Actions Permissions & Secrets Health

```bash
# Check default workflow permissions
gh api "/repos/${OWNER}/${NAME}/actions/permissions" \
  --jq '"Actions enabled: \(.enabled)\nDefault permission: \(.default_workflow_permissions // "unknown")"' 2>/dev/null

# List repo secret names and ages (values never shown)
echo "--- Repository Secrets ---"
gh api "/repos/${OWNER}/${NAME}/actions/secrets" \
  --jq '.secrets[] | "\(.name) (last updated: \(.updated_at))"' 2>/dev/null

# Warn about secrets not rotated in 180+ days
gh api "/repos/${OWNER}/${NAME}/actions/secrets" 2>/dev/null | \
  python3 -c "
import sys, json
from datetime import datetime, timezone
try:
    data = json.load(sys.stdin)
    for s in data.get('secrets', []):
        updated = s.get('updated_at', '')
        try:
            dt = datetime.fromisoformat(updated.replace('Z', '+00:00'))
            age = (datetime.now(timezone.utc) - dt).days
            if age > 180:
                print(f'STALE SECRET ({age} days): {s[\"name\"]} — consider rotating')
        except: pass
except: pass
" 2>/dev/null || true
```

---
