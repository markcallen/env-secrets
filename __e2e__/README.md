# End-to-End Tests

This directory contains comprehensive end-to-end tests for the env-secrets CLI tool.

## Prerequisites

### LocalStack Setup

The e2e tests use LocalStack to emulate AWS Secrets Manager. You need to have LocalStack running before executing the tests.

#### Using Docker Compose (Recommended)

```bash
# Start LocalStack
docker-compose up -d localstack

# Wait for LocalStack to be ready
docker-compose logs -f localstack
```

#### Manual LocalStack Setup

```bash
# Install LocalStack
pip install localstack

# Start LocalStack
localstack start
```

### awslocal Setup

The tests require `awslocal` to be installed, which is a wrapper around AWS CLI that automatically points to LocalStack:

```bash
# Install awslocal using pip (recommended)
pip install awscli-local

# Or using npm
npm install -g awscli-local

# Verify installation
awslocal --version

# Test connectivity to LocalStack
awslocal sts get-caller-identity
```

**Note**: The tests will automatically check if `awslocal` is installed and provide helpful error messages if it's missing.

## Environment Variables

The following environment variables are used by the e2e tests:

- `LOCALSTACK_URL`: LocalStack endpoint (default: `http://localhost:4566`)
- `AWS_ACCESS_KEY_ID`: AWS access key (default: `test`)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key (default: `test`)
- `AWS_DEFAULT_REGION`: AWS region (default: `us-east-1`)
- `DEBUG`: Enable debug output (optional)

**Note**: The tests automatically clean up AWS environment variables (like `AWS_PROFILE`, `AWS_SESSION_TOKEN`, etc.) to ensure a clean test environment.

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run E2E Tests with Coverage

```bash
npm run test:e2e:coverage
```

### Run Specific Test File

```bash
npm run build
npx jest --config jest.e2e.config.js __e2e__/index.test.ts
```

### Run Tests with Debug Output

```bash
DEBUG=1 npm run test:e2e
```

## Test Structure

### Test Categories

1. **CLI Help Commands**: Tests for help, version, and general CLI functionality
2. **AWS Secrets Manager Integration**: Tests for secret retrieval using different credential methods
3. **Output to File**: Tests for writing secrets to files
4. **Program Execution**: Tests for executing programs with injected environment variables
5. **Error Handling**: Tests for various error scenarios

### Test Utilities

The `utils/test-utils.ts` file provides helper functions:

- `LocalStackHelper`: Manages LocalStack operations (create/delete secrets, wait for readiness)
- `cli()`: Execute CLI commands
- `cliWithEnv()`: Execute CLI commands with custom environment variables
- `createTempFile()` / `cleanupTempFile()`: Manage temporary files
- `createTestProfile()` / `restoreTestProfile()`: Manage AWS profiles

### Test Secrets

The tests create and use several test secrets:

- `test-secret-basic`: Basic JSON secret with API key and database URL
- `test-secret-simple`: Simple string secret
- `test-secret-complex`: Complex JSON with nested objects and arrays
- `test-secret-special-chars`: Secret with special characters

## Troubleshooting

### LocalStack Not Starting

If LocalStack fails to start:

1. Check if port 4566 is available
2. Ensure Docker is running
3. Check LocalStack logs: `docker-compose logs localstack`

### awslocal Issues

If awslocal commands fail:

1. Verify awslocal is installed: `awslocal --version`
2. Test LocalStack connectivity: `awslocal sts get-caller-identity`
3. Check if LocalStack is running: `docker-compose ps`

### Test Failures

Common issues and solutions:

1. **Timeout errors**: Increase timeout in `jest.e2e.config.js`
2. **Permission errors**: Ensure proper file permissions for AWS credentials
3. **Network errors**: Check LocalStack endpoint URL and connectivity

## Continuous Integration

The e2e tests are designed to run in CI environments. Make sure to:

1. Start LocalStack before running tests
2. Set appropriate environment variables
3. Install AWS CLI in the CI environment
4. Allow sufficient time for LocalStack to start

## Coverage Reports

Coverage reports are generated in the `coverage-e2e/` directory:

- `coverage-e2e/lcov-report/index.html`: HTML coverage report
- `coverage-e2e/lcov.info`: LCOV format for CI integration
- `coverage-e2e/coverage-final.json`: JSON coverage data
