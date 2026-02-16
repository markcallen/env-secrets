# Local Development: GitHub and Issues MCP (Optional)

These rules are intended for Codex (CLI and app).

Use GitHub MCP and/or issues MCP (Jira, Linear, GitHub Issues) when available to support local development context. Only apply when these MCP servers are enabled.

---

# Optional: GitHub and Issues MCP Servers

When the user has **GitHub MCP** and/or **issues MCP** (Jira, Linear, or GitHub Issues) servers enabled, use them to support local development workflow and context.

## When to Use This Rule

- The user asks for a summary of open work (PRs, issues, Jira/Linear items).
- The user wants to correlate code changes with tickets or PRs.
- The user is starting work and needs context from assigned or in-progress items.

## GitHub MCP

If the **GitHub MCP** server is available:

- **Pull requests**: List or summarize open PRs for the current repo (or org). Help the user triage, review, or land PRs.
- **Repos and orgs**: Use repo/org context when the user asks about “my PRs” or “our open PRs.”
- **Branches and commits**: When relevant to local dev, use GitHub MCP to check branch status, CI status, or linked issues.

Do not assume the server is present; only use it when it is configured and the user’s request fits (e.g. “summarize my PRs”, “what’s open in this repo?”).

## Issues MCP (Jira / Linear / GitHub Issues)

If an **issues MCP** server is available (Jira, Linear, or GitHub Issues):

- **Assigned work**: When the user asks “what am I working on?” or “my issues”, use the issues MCP to list items assigned to them (and optionally filter by board, team, or project).
- **Sprint / cycle / milestone**: For Jira (board/sprint) or Linear (team/cycle), summarize current sprint or cycle work when the user asks.
- **Correlation with code**: When the user mentions a ticket ID (e.g. `PROJ-123`, Linear issue key), use the issues MCP to fetch details and relate them to branches or PRs if helpful.

Configuration (e.g. which board, team, or filters) is typically stored in project docs (e.g. `CLAUDE.md`, `AGENTS.md`) or a config file (e.g. `work_summary` YAML). Prefer not to overwrite that config; use it to scope queries.

## Scope

- **Optional**: This rule applies only when the corresponding MCP servers are enabled. Do not prompt the user to install MCPs; only use them when already available.
- **Local-dev focus**: Use these MCPs to support _local development_ context (what to work on next, PR/issue context while coding), not as a general “work summary” agent. Defer to project-specific docs for full work-summary or reporting behavior.
- **Documentation**: If you add or change how MCPs are used, suggest updating README or runbooks (e.g. “Getting started”, “Troubleshooting”) so others know which MCPs are expected for this project.

## Configuration Reference

Projects may document MCP usage in a structure like:

```yaml
work_summary:
  mcp_tools:
    github: github
    jira: jira # optional
    linear: linear # optional
  sources:
    pull_requests: true
    github_issues:
      enabled: false
      scope: { mode: repos, orgs: [], repos: [] }
      filters: { assigned_to_me: true, labels: [] }
    jira:
      enabled: false
      board: ''
      only_assigned_to_me: true
    linear:
      enabled: false
      team: ''
      view: cycle
      only_assigned_to_me: true
```

Respect such configuration when querying; use it to scope lists (e.g. “assigned to me”, specific board/team) rather than inventing defaults.
