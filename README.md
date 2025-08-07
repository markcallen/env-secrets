# env-secrets

A Node.js CLI tool that retrieves secrets from vaults and injects them as environment variables into your running applications.

[![Version](https://img.shields.io/npm/v/env-secrets.svg)](https://npmjs.org/package/env-secrets)
[![build](https://img.shields.io/github/actions/workflow/status/markcallen/env-secrets/build-main.yml)](https://github.com/markcallen/env-secrets/tree/main)
[![test](https://img.shields.io/github/actions/workflow/status/markcallen/env-secrets/unittests.yaml)](https://github.com/markcallen/env-secrets/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/env-secrets.svg)](https://npmjs.org/package/env-secrets)
[![License](https://img.shields.io/npm/l/env-secrets.svg)](https://github.com/markcallen/env-secrets/blob/main/LICENSE)

## Features

- 🔐 Retrieve secrets from AWS Secrets Manager
- 🌍 Inject secrets as environment variables
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

## Prerequisites

- Node.js 18.0.0 or higher
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

### AWS Secrets Manager

Retrieve secrets from AWS Secrets Manager and inject them as environment variables:

```bash
env-secrets aws -s <secret-name> -r <region> -p <profile> -- <program-to-run>
```

#### Parameters

- `-s, --secret <secret-name>` (required): The name of the secret in AWS Secrets Manager
- `-r, --region <region>` (optional): AWS region where the secret is stored. If not provided, uses `AWS_DEFAULT_REGION` environment variable
- `-p, --profile <profile>` (optional): Local AWS profile to use. If not provided, uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables
- `-- <program-to-run>`: The program to run with the injected environment variables

#### Examples

1. **Create a secret using AWS CLI:**

```bash
aws secretsmanager create-secret \
    --region us-east-1 \
    --profile marka \
    --name local/sample \
    --description "local/sample secret" \
    --secret-string "{\"user\":\"marka\",\"password\":\"mypassword\"}"
```

2. **List the secret using AWS CLI:**

```bash
aws secretsmanager get-secret-value \
    --region us-east-1 \
    --profile marka \
    --secret-id local/sample \
    --query SecretString
```

3. **Run a command with injected secrets:**

```bash
env-secrets aws -s local/sample -r us-east-1 -p marka -- echo \${user}/\${password}
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

## Security Considerations

- 🔐 **Credential Management**: The tool respects AWS credential precedence (environment variables, IAM roles, profiles)
- 🛡️ **Secret Exposure**: Secrets are only injected into the child process environment, not logged
- 🔒 **Network Security**: Uses AWS SDK's built-in security features for API calls
- 📝 **Audit Trail**: AWS CloudTrail logs all Secrets Manager API calls
- 🚫 **No Persistence**: Secrets are not stored locally or cached

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

## Development

### Setup

1. **Install Node.js using nvm (recommended):**

```bash
nvm use
```

Or use Node.js 20 (LTS) directly.

2. **Install dependencies:**

```bash
npm install -g yarn
yarn
```

### Running in Development

```bash
npx ts-node src/index.ts aws -s local/sample -r us-east-1 -p marka -- env
```

### Debugging

The application uses `debug-js` for logging. Enable debug logs by setting the `DEBUG` environment variable:

```bash
# Debug main application
DEBUG=env-secrets npx ts-node src/index.ts aws -s local/sample -r us-east-1 -p marka -- env

# Debug vault-specific operations
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

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

awslocal secretsmanager create-secret \
 --name my-secret-name \
 --secret-string '{"username": "admin", "password": "hunter2"}'

awslocal secretsmanager list-secrets

awslocal secretsmanager get-secret-value \
 --secret-id my-secret-name

alias awslocal="AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566"

for k8s

AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localstack.localstack:4566 secretsmanager list-secrets --region us-east-1

### Devpod Setup

Create a devpod using Kubernetes provider:

```bash
devpod up --id env-secretes-dev --provider kubernetes --ide cursor git@github.com:markcallen/env-secrets.git
```

## Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run unit tests with coverage
npm run test:unit:coverage

# Run end-to-end tests
npm run test:e2e
```

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
