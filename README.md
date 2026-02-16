# env-secrets

A Node.js CLI tool that retrieves secrets from vaults and injects them as environment variables into your running applications.

[![Version](https://img.shields.io/npm/v/env-secrets.svg)](https://npmjs.org/package/env-secrets)
[![build](https://img.shields.io/github/actions/workflow/status/markcallen/env-secrets/build-main.yml)](https://github.com/markcallen/env-secrets/tree/main)
[![test](https://img.shields.io/github/actions/workflow/status/markcallen/env-secrets/unittests.yaml)](https://github.com/markcallen/env-secrets/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/env-secrets.svg)](https://npmjs.org/package/env-secrets)
[![License](https://img.shields.io/npm/l/env-secrets.svg)](https://github.com/markcallen/env-secrets/blob/main/LICENSE)
[![Website](https://img.shields.io/badge/docs-website-blue)](https://markcallen.github.io/env-secrets/)

## Features

- 🔐 Retrieve secrets from AWS Secrets Manager
- 🌍 Inject secrets as environment variables
- 📁 Output secrets to file with secure permissions (0400)
- 🚀 Run any command with injected secrets
- 🔍 Debug logging support
- 📦 Works globally or project-specific
- 🛡️ Secure credential handling
- 🔄 JSON secret parsing

## Quick Start

1. **Install the tool:**

   ```bash
   npm install -g env-secrets
   ```

2. **Run a command with secrets:**

   ```bash
   env-secrets aws -s my-secret-name -r us-east-1 -- echo "Hello, ${USER_NAME}!"
   ```

3. **Run your application with secrets:**

   ```bash
   env-secrets aws -s my-app-secrets -r us-west-2 -- node app.js
   ```

4. **Output secrets to a file:**
   ```bash
   env-secrets aws -s my-app-secrets -r us-west-2 -o secrets.env
   ```

## Prerequisites

- Node.js 20.0.0 or higher
- AWS CLI (for AWS Secrets Manager integration)
- AWS credentials configured (via AWS CLI, environment variables, or IAM roles)

## Installation

### Global Installation

```bash
npm install -g env-secrets
```

### Project-Specific Installation

```bash
npm install env-secrets
```

When using project-specific installation, run using `npx`:

```bash
npx env-secrets ...
```

## Usage

For detailed AWS setup instructions, see [AWS Configuration Guide](docs/AWS.md).

### AWS Secrets Manager

Retrieve secrets from AWS Secrets Manager and inject them as environment variables:

```bash
env-secrets aws -s <secret-name> -r <region> -p <profile> [-- <program-to-run>] [-o <output-file>]
```

#### Quick Example

```bash
# Create a secret
aws secretsmanager create-secret \
    --name my-app-secrets \
    --secret-string '{"DATABASE_URL":"postgres://user:pass@localhost:5432/db","API_KEY":"abc123"}'

# Use the secret in your application
env-secrets aws -s my-app-secrets -r us-east-1 -- node app.js
```

#### Parameters

- `-s, --secret <secret-name>` (required): The name of the secret in AWS Secrets Manager
- `-r, --region <region>` (optional): AWS region where the secret is stored. If not provided, uses `AWS_DEFAULT_REGION` environment variable
- `-p, --profile <profile>` (optional): Local AWS profile to use. If not provided, uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables
- `-o, --output <file>` (optional): Output secrets to a file instead of injecting into environment variables. File will be created with 0400 permissions and will not overwrite existing files
- `-- <program-to-run>`: The program to run with the injected environment variables (only used when `-o` is not specified)

For `aws secret` management subcommands (`create`, `update`, `list`, `get`, `delete`), use:

- `-r, --region <region>` to target a specific region
- `-p, --profile <profile>` to select credentials profile
- `--output <format>` for `json` or `table`

These options are honored consistently on `aws secret` subcommands.

#### Examples

1. **Create a secret using AWS CLI:**

Using a profile:

```bash
aws secretsmanager create-secret \
    --region us-east-1 \
    --profile testuser \
    --name local/sample \
    --description "local/sample secret" \
    --secret-string "{\"user\":\"testuser\",\"password\":\"mypassword\"}"
```

Using env vars

```bash
aws secretsmanager create-secret \
    --region us-east-1 \
    --name local/sample \
    --description "local/sample secret" \
    --secret-string "{\"user\":\"marka\",\"password\":\"mypassword\"}"
```

2. **List the secret using AWS CLI:**

Using a profile:

```bash
aws secretsmanager get-secret-value \
    --region us-east-1 \
    --profile marka \
    --secret-id local/sample \
    --query SecretString
```

Using env vars:

```bash
aws secretsmanager get-secret-value \
    --region us-east-1 \
    --secret-id local/sample \
    --query SecretString
```

3. **Run a command with injected secrets:**

Using a profile:

```bash
env-secrets aws -s local/sample -r us-east-1 -p marka -- echo \${user}/\${password}
```

Using env vars:

```bash
env-secrets aws -s local/sample -r us-east-1 -- echo \${user}/\${password}
```

4. **Run a Node.js application with secrets:**

```bash
env-secrets aws -s my-app-secrets -r us-west-2 -- node app.js
```

5. **Check environment variables:**

```bash
env-secrets aws -s local/sample -r us-east-1 -p marka -- env | grep -E "(user|password)"
```

6. **Use with Docker containers:**

```bash
env-secrets aws -s docker-secrets -r us-east-1 -- docker run -e DATABASE_URL -e API_KEY my-app
```

7. **Output secrets to a file:**

```bash
# Output secrets to a file (file will have 0400 permissions)
env-secrets aws -s my-app-secrets -r us-east-1 -o secrets.env

# The file will contain export statements like:
# export DATABASE_URL=postgres://user:pass@localhost:5432/db
# export API_KEY=abc123
```

8. **File output with profile:**

```bash
env-secrets aws -s my-secret -r us-east-1 -p my-profile -o /tmp/secrets.env
```

9. **File output prevents overwriting existing files:**

```bash
# First run - creates the file
env-secrets aws -s my-secret -r us-east-1 -o secrets.env

# Second run - will fail with error message
env-secrets aws -s my-secret -r us-east-1 -o secrets.env
# Error: File secrets.env already exists and will not be overwritten
```

## Security Considerations

- 🔐 **Credential Management**: The tool respects AWS credential precedence (environment variables, IAM roles, profiles)
- 🛡️ **Secret Exposure**: Secrets are only injected into the child process environment, not logged
- 🔒 **Network Security**: Uses AWS SDK's built-in security features for API calls
- 📝 **Audit Trail**: AWS CloudTrail logs all Secrets Manager API calls
- 🚫 **No Persistence**: Secrets are not stored locally or cached (unless using `-o` flag)
- 📁 **File Security**: When using `-o` flag, files are created with 0400 permissions (read-only for owner) and existing files are never overwritten

## Troubleshooting

### Common Issues

1. **"Unable to connect to AWS"**

   - Verify AWS credentials are configured correctly
   - Check if the specified region is valid
   - Ensure network connectivity to AWS services

2. **"Secret not found"**

   - Verify the secret name exists in the specified region
   - Check if you have permissions to access the secret
   - Ensure the secret name is correct (case-sensitive)

3. **"ConfigError"**

   - Verify AWS profile configuration in `~/.aws/credentials`
   - Check if environment variables are set correctly
   - Ensure IAM role permissions if using EC2/ECS

4. **Environment variables not injected**
   - Verify the secret contains valid JSON
   - Check if the secret is accessible
   - Use debug mode to troubleshoot: `DEBUG=env-secrets env-secrets aws ...`

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
# Debug main application
DEBUG=env-secrets env-secrets aws -s my-secret -r us-east-1 -- env

# Debug vault-specific operations
DEBUG=env-secrets,env-secrets:secretsmanager env-secrets aws -s my-secret -r us-east-1 -- env
```

## Documentation

The docs site (Docusaurus) lives under [`website/`](./website). Run it locally:

```bash
cd website
npm install
npm run start
```

To build static files:

```bash
npm run build
npm run serve
```

The site is configured for GitHub Pages at https://markcallen.github.io/env-secrets/

## Development

### Setup

1. **Install Node.js using nvm (recommended):**

```bash
nvm use
```

Or use Node.js 24 (LTS) directly.

2. **Install dependencies:**

```bash
npm install -g yarn
yarn
```

### Running in Development

```
npx ts-node src/index.ts aws -s local/sample -r us-east-1 -p marka -- env
```

### Debugging

The application uses `debug-js` for logging. Enable debug logs by setting the `DEBUG` environment variable:

Debug just env-secrets

```bash
DEBUG=env-secrets npx ts-node src/index.ts aws -s local/sample -r us-east-1 -p marka -- env
```

Debug env-secrets and the secretsmanager vault

```
DEBUG=env-secrets,env-secrets:secretsmanager npx ts-node src/index.ts aws -s local/sample -r us-east-1 -p marka -- env
```

### LocalStack Development

For local development without AWS, you can use LocalStack to emulate AWS services.

1. **Install LocalStack:**

If you've started a devcontainer then localstack is already installed and has access to your hosts docker.

For local development use docker compose.

For kubernetes you can install it via the helm chart:

```

helm repo add localstack-repo https://helm.localstack.cloud
helm upgrade --install localstack localstack-repo/localstack --namespace localstack --create-namespace

```

1. **Start LocalStack:**

To use localstack from within a devcontainer run:

```

localstack start -d

```

For local development you can start it with docker compose.

```

docker compose up -d

```

3. **Configure AWS CLI for LocalStack:**

Set up your AWS CLI to work with LocalStack by creating a profile:

```

aws configure --profile localstack

```

Use:

```

AWS Access Key ID [None]: test
AWS Secret Access Key [None]: test
Default region name [None]: us-east-1
Default output format [None]:

```

Then export the profile and the endpoint url:

```

export AWS_PROFILE=localstack
export AWS_ENDPOINT_URL=http://localhost:4566

```

To use the env vars set:

```

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

```

for kubernetes the endpoint url is:

```

export AWS_ENDPOINT_URL=http://localstack.localstack:4566

```

4. **Using awslocal**

```

awslocal secretsmanager create-secret \
 --name local/sample \
 --secret-string '{"username": "marka", "password": "mypassword"}'

```

```

awslocal secretsmanager list-secrets

```

```

awslocal secretsmanager get-secret-value \
 --secret-id local/sample

```

### Devpod Setup

Create a devpod using Kubernetes provider:

```bash
devpod up --id env-secretes-dev --provider kubernetes --ide cursor git@github.com:markcallen/env-secrets.git
```

## Testing

This project includes both unit tests and comprehensive end-to-end tests.

### Unit Tests

Run the unit test suite:

```bash
# Run all unit tests
npm run test:unit

# Run unit tests with coverage
npm run test:unit:coverage
```

### End-to-End Tests

The end-to-end tests use LocalStack to emulate AWS Secrets Manager and test the full CLI functionality.

#### Prerequisites

1. **Install awslocal** (required for e2e tests):

   ```bash
   # macOS/Linux (recommended)
   brew install awscli-local
   ```

2. **Start LocalStack**:

   ```bash
   docker-compose up -d localstack
   ```

3. **Wait for LocalStack to be ready**:

   ```bash
   # Check LocalStack status
   docker-compose logs localstack

   # Test connectivity
   awslocal sts get-caller-identity
   ```

#### Running E2E Tests

```bash
# Run all tests (unit + e2e)
npm test

# Run only end-to-end tests
npm run test:e2e

# Run e2e tests with coverage
npm run test:e2e:coverage

# Run specific e2e test
yarn build && npx jest --config jest.e2e.config.js __e2e__/index.test.ts -t "test name"
```

#### E2E Test Features

The end-to-end test suite includes:

- **CLI Help Commands**: Tests for help, version, and general CLI functionality
- **AWS Secrets Manager Integration**: Tests for secret retrieval using different credential methods
- **Output to File**: Tests for writing secrets to files with proper permissions
- **Program Execution**: Tests for executing programs with injected environment variables
- **Error Handling**: Tests for various error scenarios and edge cases
- **AWS Profile Support**: Tests for both default and custom AWS profiles
- **Region Support**: Tests for different AWS regions, including multi-region `aws secret list` isolation checks

#### Troubleshooting E2E Tests

**awslocal not found**:

```bash
# Install awslocal (macOS/Linux)
brew install awscli-local

# Verify installation
awslocal --version
```

**LocalStack not responding**:

```bash
# Check LocalStack status
docker-compose ps

# Restart LocalStack
docker-compose restart localstack

# Check logs
docker-compose logs localstack
```

**Tests timing out**:

- Ensure LocalStack is fully started before running tests
- Check that port 4566 is not blocked
- Verify Docker is running properly

#### Environment Variables

The e2e tests use these environment variables:

- `LOCALSTACK_URL`: LocalStack endpoint (default: `http://localhost:4566`)
- `AWS_ACCESS_KEY_ID`: AWS access key (default: `test`)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key (default: `test`)
- `AWS_DEFAULT_REGION`: AWS region (default: `us-east-1`)
- `DEBUG`: Enable debug output (optional)

**Note**: The tests automatically clean up AWS environment variables (like `AWS_PROFILE`, `AWS_SESSION_TOKEN`, etc.) to ensure a clean test environment.

For more detailed information, see the [E2E Test Documentation](__e2e__/README.md).

## Publishing

1. **Login to npm:**

```bash
npm login
```

2. **Dry run release:**

```bash
npm run release -- patch --dry-run
```

3. **Publish release:**

```bash
npm run release -- patch
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run the test suite (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Follow the existing code style (ESLint + Prettier)
- Add tests for new functionality
- Update documentation for new features
- Ensure all tests pass before submitting

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Mark C Allen - [@markcallen](https://www.linkedin.com/in/markcallen/)

Project Link: [https://github.com/markcallen/env-secrets](https://github.com/markcallen/env-secrets)

## Changelog

See [GitHub Releases](https://github.com/markcallen/env-secrets/releases) for a complete changelog.
