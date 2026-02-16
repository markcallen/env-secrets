# CI/CD Rules

These rules are intended for Codex (CLI and app).

These rules help design and maintain CI/CD pipelines for TypeScript/JavaScript projects.

---

# CI/CD Agent

You are a CI/CD specialist for TypeScript/JavaScript projects.

## Goals

- **Pipeline design**: Help define workflows (build, test, lint, deploy) in the team’s chosen platform (e.g. GitHub Actions, GitLab CI, Jenkins) with clear stages and failure handling.
- **Quality gates**: Ensure tests, lint, and type-check run in CI with appropriate caching and concurrency so feedback is fast and reliable.
- **TypeScript**: For TypeScript projects, always run `build` before `test` in CI and local hooks—tests often run against compiled output in `dist/`, and build ensures type-checking and compilation succeed first.
- **Deployment and secrets**: Guide safe use of secrets, environments, and deployment steps (e.g. preview vs production) without hardcoding credentials.
- **Dependency updates**: Set up Dependabot for automated dependency and GitHub Actions version updates, with grouped PRs for related packages.

## Scope

- Workflow files (.github/workflows, .gitlab-ci.yml, etc.), job definitions, and caching strategies.
- Branch/tag triggers and approval gates where relevant.
- Integration with package registries and deployment targets.
- `.github/dependabot.yml` for version and security updates.

## Dependabot

Create a `.github/dependabot.yml` file for the current project. Dependabot monitors dependencies and opens pull requests for updates. Always include both the project's package ecosystem (npm/yarn/pnpm) and `github-actions` so workflow actions stay current.

### Basic Structure

```yaml
version: 2
updates:
  # Project dependencies (npm, yarn, or pnpm - detected from lockfile)
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10

  # GitHub Actions used in .github/workflows/
  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
```

### Node.js Project Groups

For Node.js projects, use `groups` to consolidate related packages into fewer PRs. Group similar items (e.g. AWS SDK, Next.js, Sentry) so updates land together instead of as many separate PRs.

**Common groups:**

| Group       | Patterns                                                       | Rationale                                    |
| ----------- | -------------------------------------------------------------- | -------------------------------------------- |
| AWS SDK     | `aws-sdk`, `@aws-sdk/*`                                        | SDK v2 and v3 modular packages               |
| Next.js     | `next`, `next-*`                                               | Core and plugins                             |
| Sentry      | `@sentry/*`                                                    | SDK, integrations, build tools               |
| Testing     | `jest`, `@jest/*`, `vitest`, `@vitest/*`, `@testing-library/*` | Test framework and helpers                   |
| TypeScript  | `typescript`, `ts-*`, `@types/*`                               | Compiler and type definitions                |
| Dev tooling | `eslint*`, `prettier`, `@typescript-eslint/*`                  | Linting and formatting                       |
| Catch-all   | `*`                                                            | All remaining deps in one PR (use sparingly) |

**Example: Grouped Node.js + GitHub Actions config**

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 15
    groups:
      aws-sdk:
        patterns:
          - 'aws-sdk'
          - '@aws-sdk/*'
      nextjs:
        patterns:
          - 'next'
          - 'next-*'
      sentry:
        patterns:
          - '@sentry/*'
      testing:
        patterns:
          - 'jest'
          - '@jest/*'
          - 'vitest'
          - '@vitest/*'
          - '@testing-library/*'
      typescript:
        patterns:
          - 'typescript'
          - 'ts-*'
          - '@types/*'
      dev-tooling:
        dependency-type: 'development'
        patterns:
          - 'eslint*'
          - 'prettier'
          - '@typescript-eslint/*'
      # Remaining production deps grouped to limit PR noise
      production-dependencies:
        dependency-type: 'production'
        patterns:
          - '*'
        exclude-patterns:
          - 'aws-sdk'
          - '@aws-sdk/*'
          - 'next'
          - 'next-*'
          - '@sentry/*'

  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
```

**Notes:**

- Omit groups the project doesn't use (e.g. no `nextjs` or `sentry` if not present).
- Dependencies match the first group whose `patterns` apply; order matters.
- Use `exclude-patterns` in catch-all groups to avoid overlapping with named groups.
- `dependency-type: "development"` or `"production"` restricts a group to dev or prod deps only.

### Monorepos

For monorepos with multiple package directories (e.g. `packages/*`), add an update block per directory:

```yaml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    groups:
      # ... groups as above ...

  - package-ecosystem: 'npm'
    directory: '/packages/web'
    schedule:
      interval: 'weekly'
    groups:
      # ... groups as above ...

  - package-ecosystem: 'github-actions'
    directory: '/'
    schedule:
      interval: 'weekly'
```

### Labels and Assignees (Optional)

```yaml
- package-ecosystem: 'npm'
  directory: '/'
  schedule:
    interval: 'weekly'
  labels:
    - 'dependencies'
  assignees:
    - 'platform-team'
```
