# Local Development: README Badges

These rules are intended for Codex (CLI and app).

Add standard badges (CI, Release, License, GitHub Release; plus npm for published packages) to the top of README.md.

---

# README Badges

When setting up or improving project documentation, add standard badges near the top of `README.md` to provide quick visibility into CI status, releases, license, and (for npm packages) npm registry info.

## Your Responsibilities

1. **Add badges at the top of README.md**

   - Place badges immediately after the main title (or project description), before the first heading.
   - Use one line of badges, separated by spaces, for a compact layout.
   - Replace `OWNER/REPO` with the actual GitHub org/user and repository name (e.g. `markcallen/cache-cleaner`).
   - Replace `PACKAGE_NAME` with the npm package name from `package.json` when adding npm badges.

2. **Include standard badges**

   - **CI** — links to the CI workflow (e.g. `ci.yml` or `lint.yml`).
   - **Release** — links to the release/publish workflow (e.g. `release.yml` or `publish.yml`).
   - **License** — links to the `LICENSE` file.
   - **GitHub Release** — links to the releases page.

3. **For npm packages**
   - If the project has a `package.json` with `name` and is published to npm, add npm badges:
     - **npm version** — shows the latest published version.
     - **npm downloads** — shows weekly or monthly download count (optional but recommended).

## Badge Markdown Examples

### GitHub Actions (CI and Release)

Use the workflow filename that exists in `.github/workflows/` (e.g. `ci.yml`, `release.yml`, `publish.yml`):

```markdown
[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Release](https://github.com/OWNER/REPO/actions/workflows/release.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/release.yml)
```

If the workflow is named `publish.yml` instead of `release.yml`, use:

```markdown
[![Release](https://github.com/OWNER/REPO/actions/workflows/publish.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/publish.yml)
```

### License and GitHub Release

```markdown
[![License](https://img.shields.io/github/license/OWNER/REPO)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/OWNER/REPO)](https://github.com/OWNER/REPO/releases)
```

### npm (for published packages)

```markdown
[![npm version](https://img.shields.io/npm/v/PACKAGE_NAME.svg)](https://www.npmjs.com/package/PACKAGE_NAME)
[![npm downloads](https://img.shields.io/npm/dm/PACKAGE_NAME.svg)](https://www.npmjs.com/package/PACKAGE_NAME)
```

## Complete Example (GitHub + npm)

```markdown
# Project Name

[![CI](https://github.com/markcallen/cache-cleaner/actions/workflows/ci.yml/badge.svg)](https://github.com/markcallen/cache-cleaner/actions/workflows/ci.yml)
[![Release](https://github.com/markcallen/cache-cleaner/actions/workflows/release.yml/badge.svg)](https://github.com/markcallen/cache-cleaner/actions/workflows/release.yml)
[![License](https://img.shields.io/github/license/markcallen/cache-cleaner)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/markcallen/cache-cleaner)](https://github.com/markcallen/cache-cleaner/releases)
[![npm version](https://img.shields.io/npm/v/cache-cleaner.svg)](https://www.npmjs.com/package/cache-cleaner)
[![npm downloads](https://img.shields.io/npm/dm/cache-cleaner.svg)](https://www.npmjs.com/package/cache-cleaner)

Project description...
```

## Implementation Order

1. Determine the GitHub `OWNER/REPO` (from git remote, package.json repository field, or user input).
2. List workflows in `.github/workflows/` to identify CI and release workflow filenames.
3. Check `package.json` for `name` and whether the package is published to npm (optional: check npm registry).
4. Add badges at the top of `README.md`, after the title and before the first `##` heading.
5. Use the correct workflow filenames; do not assume `ci.yml` or `release.yml` if different names exist.

## When to Apply

- When creating a new project with a README.
- When a README lacks badges at the top.
- When adding CI or release workflows and the README does not yet link to them.
- When publishing an npm package and the README does not show npm badges.
