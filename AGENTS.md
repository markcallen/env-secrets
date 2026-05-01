# AGENTS.md

## Project Overview

- **env-secrets**: A Node.js CLI tool that retrieves secrets from vaults and injects them as environment variables
- **Repository**: https://github.com/markcallen/env-secrets
- **Issue Tracking**: Uses GitHub issues for feature requests and bugs

## Code Style Guidelines

### TypeScript

- **Strict Mode**: Enabled, use proper types, avoid `any`
- **Type Definitions**: Prefer interfaces over types for object shapes
- **Generic Types**: Use when appropriate for reusable components

### Imports

- **Order**: Group by: external libraries, internal modules, relative imports
- **Style**: ES6 imports (`import`/`export`)
- **Barrel Exports**: Use index files for clean import paths

### Formatting

- **Prettier**: Default config (.prettierrc), 2-space indentation
- **Line Length**: Let Prettier handle line wrapping
- **Trailing Commas**: Use in objects and arrays

### Naming Conventions

- **Variables/Functions**: camelCase
- **Components/Types**: PascalCase
- **Constants**: UPPER_CASE
- **Files**: kebab-case for files, PascalCase for components

## Development Workflow

### Pre-commit Hooks

- Husky is configured for pre-commit hooks
- lint-staged runs prettier and eslint on staged files

### Quality Checks

Always run quaity checks after creating or modifing files

- **Linting**: `yarn lint` - runs ESLint with TypeScript support
- **Formatting**: `yarn prettier:fix` - formats code with Prettier
- **Type Checking**: `yarn build` - compiles TypeScript and checks types

### Testing Strategy

Always run unit tests after creating or modifying files.  
Always start Docker Compose LocalStack and run end to end tests before pushing code to a remote git repository.

- **Unit Tests**: Jest framework, located in `__tests__/`
- **E2E Tests**: Located in `__e2e__/`
- **Coverage**: Run `yarn test:unit:coverage` for coverage reports
- **Test Commands**:
  - `yarn test` - runs all tests
  - `yarn test:unit` - runs unit tests only
  - `yarn test:e2e` - builds and runs e2e tests
  - `docker compose up -d localstack` - start LocalStack for e2e tests

## Project Structure

```
src/           # Source code
├── index.ts   # Main entry point
├── aws.ts     # AWS Secrets Manager integration
└── types.ts   # TypeScript type definitions

__tests__/     # Unit tests
__e2e__/       # End-to-end tests
docs/          # Documentation
website/       # Documentation website
dist/          # Compiled output (generated)
```

## Dependencies and Tools

### Key Dependencies

- **AWS SDK**: For Secrets Manager integration
- **Commander**: CLI argument parsing
- **Debug**: Debug logging support

### Development Tools

- **TypeScript**: 4.9.5 with strict mode
- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Husky**: Git hooks
- **lint-staged**: Pre-commit linting

## Common Commands

### Development

```bash
yarn build          # Build the project
yarn start          # Run the built application
yarn lint           # Run ESLint
yarn prettier:fix   # Format code with Prettier
yarn test           # Run all tests
yarn test:unit      # Run unit tests only
yarn test:e2e       # Run e2e tests
```

### Quality Assurance

```bash
yarn prettier:check # Check formatting without fixing
yarn test:unit:coverage # Run tests with coverage
```

## Contributing

### Before Submitting

1. Run `yarn prettier:fix && yarn lint` to ensure code quality
2. Run `yarn test` to ensure all tests pass
3. Run `docker compose up -d localstack` and then `yarn test:e2e` before pushing
4. Update tests for new features or bug fixes
5. Update documentation if needed

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the code style guidelines
3. Add tests for new functionality
4. Ensure all CI checks pass
5. Submit a pull request with a clear description
6. Always request a GitHub Copilot review on every new pull request
7. After requesting Copilot review, wait 5 minutes and check for review comments
8. If no Copilot review is present yet, wait another 5 minutes and check again
9. Create a plan to address Copilot feedback, but evaluate each suggestion critically and do not accept recommendations blindly

## Development Environment

### Prerequisites

- Node.js 20.0.0 or higher (see .nvmrc)
- Yarn package manager
- AWS CLI (for testing AWS integration)
- Homebrew (macOS/Linux) with `awscli-local` installed:
  - `brew install awscli-local`

### Setup

```bash
git clone https://github.com/markcallen/env-secrets.git
cd env-secrets
yarn install
brew install awscli-local
yarn build
```

## Installed agent rules

Created by [Ballast](https://github.com/everydaydevopsio/ballast) v5.9.2. Do not edit this section.

Read and follow these rule files in `.codex/rules/` when they apply:

- `.codex/rules/local-dev-badges.md` — Add standard badges (CI, Release, License, GitHub Release, npm) to the top of README.md
- `.codex/rules/local-dev-env.md` — Local development environment specialist - reproducible dev setup, DX, and documentation
- `.codex/rules/local-dev-license.md` — License setup - ensure LICENSE file, package.json license field, and README reference (default MIT; overridable in AGENTS.md/CLAUDE.md)
- `.codex/rules/local-dev-mcp.md` — Optional: use GitHub MCP and issues MCP (Jira/Linear/GitHub) for local-dev context
- `.codex/rules/docs.md` — Documentation specialist - GitHub Markdown docs by default, or maintain existing Docusaurus sites with publish-docs automation
- `.codex/rules/cicd.md` — CI/CD specialist - pipeline design, quality gates, and deployment
- `.codex/rules/observability.md` — Observability specialist - logging, tracing, metrics, and SLOs
- `.codex/rules/publishing-api.md` — REST API publishing specialist - Docker CD with Kubernetes health probes and Helm chart update
- `.codex/rules/publishing-apps.md` — App publishing specialist - npmjs for Node apps, PyPI for Python apps, GitHub Releases for Go apps
- `.codex/rules/publishing-apt.md` — APT/deb package publishing specialist - GoReleaser nfpms and GitHub Releases
- `.codex/rules/publishing-brew.md` — Homebrew tap publishing specialist - GoReleaser brews block and tap repo setup
- `.codex/rules/publishing-cli.md` — CLI publishing specialist - GoReleaser for Go, npmjs for Node, PyPI for Python
- `.codex/rules/publishing-libraries.md` — Library publishing specialist - npmjs for TypeScript, PyPI for Python, GitHub tags/releases for Go
- `.codex/rules/publishing-sdks.md` — SDK publishing specialist - npmjs for TypeScript SDKs, PyPI for Python SDKs, GitHub tags/releases for Go SDKs
- `.codex/rules/publishing-web.md` — Web app publishing specialist - Docker to GHCR/Docker Hub with Helm chart CD on push to main
- `.codex/rules/git-hooks.md` — Git hook specialist - configure pre-commit, pre-push, and Husky workflows that match the repository layout
- `.codex/rules/typescript-linting.md` — TypeScript linting specialist - implements comprehensive linting and code formatting for TypeScript/JavaScript projects
- `.codex/rules/typescript-logging.md` — Centralized logging specialist - configures Pino with Fluentd for Node/Next.js, and pino-browser to /api/logs
- `.codex/rules/typescript-testing.md` — Testing specialist - sets up Jest (default) or Vitest for Vite projects, 50% coverage, and test step in build GitHub Action

## Installed skills

Created by [Ballast](https://github.com/everydaydevopsio/ballast) v5.9.2. Do not edit this section.

Read and use these skill files in `.codex/rules/` when they are relevant:

- `.codex/rules/github-health-check.md` — Run a comprehensive GitHub repository health check. Use this skill whenever the user asks to: check GitHub health, audit the repo, check CI status, review open PRs, merge Dependabot PRs, check code coverage, check GitHub Code Quality, check GitHub security feature enablement, check security advisories, check Dependabot alerts, check code scanning alerts, check secret scanning alerts, check Snyk integration, keep GitHub in good shape, or any variation of "how is the repo doing". Also trigger for: "check dependabot PRs", "any PRs to merge", "check branch status", "repo health", "GitHub status check", "what needs attention in GitHub", "tidy up GitHub".
