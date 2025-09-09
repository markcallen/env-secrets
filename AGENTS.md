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
Always run end to end tests before pushing code to a remote git repository.

- **Unit Tests**: Jest framework, located in `__tests__/`
- **E2E Tests**: Located in `__e2e__/`
- **Coverage**: Run `yarn test:unit:coverage` for coverage reports
- **Test Commands**:
  - `yarn test` - runs all tests
  - `yarn test:unit` - runs unit tests only
  - `yarn test:e2e` - builds and runs e2e tests

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
3. Update tests for new features or bug fixes
4. Update documentation if needed

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the code style guidelines
3. Add tests for new functionality
4. Ensure all CI checks pass
5. Submit a pull request with a clear description

## Development Environment

### Prerequisites

- Node.js 18.0.0 or higher (see .nvmrc)
- Yarn package manager
- AWS CLI (for testing AWS integration)

### Setup

```bash
git clone https://github.com/markcallen/env-secrets.git
cd env-secrets
yarn install
yarn build
```
