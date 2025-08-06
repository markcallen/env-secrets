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

## Prerequisites

- Node.js 18.0.0 or higher
- AWS CLI (for AWS Secrets Manager integration)

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

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Mark C Allen - [@markcallen](https://www.linkedin.com/in/markcallen/)

Project Link: [https://github.com/markcallen/env-secrets](https://github.com/markcallen/env-secrets)
