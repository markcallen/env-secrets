# env-secrets

Get secrets from a vault and inject them as environment variables

[![Version](https://img.shields.io/npm/v/env-secrets.svg)](https://npmjs.org/package/env-secrets)
[![build](https://img.shields.io/github/actions/workflow/status/markcallen/env-secrets/build-main.yml)](https://github.com/markcallen/env-secrets/tree/main)
[![test](https://img.shields.io/github/actions/workflow/status/markcallen/env-secrets/unittests.yaml)](https://github.com/markcallen/env-secrets/tree/main)
![vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/markcallen/env-secrets)
[![Downloads/week](https://img.shields.io/npm/dw/env-secrets.svg)](https://npmjs.org/package/env-secrets)
[![License](https://img.shields.io/npm/l/env-secrets.svg)](https://github.com/markcallen/env-secrets/blob/main/LICENSE)

## Setup

Install node

## Installation

Globally

```
npm install -g env-secrets
```

Project specific

```
npm install env-secrets
```

when using project specific run using npx

```
npx env-secrets ...
```

## Usage

How to setup access to AWS [docs/AWS.md](docs/AWS.md)

AWS

```
env-secrets aws -s <secret name> -r <region> -p <profile> -- <program to run>
```

`<secret name>` is the name of the secret in Secrets Manager

`<region>` is the region where the secret to stored. It is optional, the AWS_DEFAULT_REGION environment variable will be used instead.

`<profile>` is the local aws profile to use. It is optional, the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables will be used instead.

example:

Create a Secret using AWS cli

```
aws secretsmanager create-secret \
    --region us-east-1 \
    --profile marka \
    --name local/sample \
    --description "local/sample secret" \
    --secret-string "{\"user\":\"marka\",\"password\":\"mypassword\"}"
```

```
env-secrets aws -s local/sample -r us-east-1 -p marka -- echo \${user}/\${password}
```

## Development

Setup node using [nvm](https://github.com/nvm-sh/nvm). Or use node 18.x.

```
nvm use
```

Install yarn

```
npm install -y yarn
```

Setup

```
yarn
```

Run

```
npx ts-node src/index.ts aws -s local/sample -r us-east-1 -p marka -- env
```

### Debug

Uses debug-js to show debug logs by passing in env-secrets for the main application
and env-secrets:{vault} for vault specific debugging

```
DEBUG=env-secrets,env-secrets:secretsmanager npx ts-node src/index.ts aws -s local/sample -r us-east-1 -p marka -- env
```

## Publishing

Login into npm

```
npm login
```

Try a dry run:

```
npm run release -- patch --dry-run
```

Run:

```
npm run release -- patch
```

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Mark C Allen - [@markcallen](https://www.linkedin.com/in/markcallen/)

Project Link: [https://github.com/markcallen/env-secrets](https://github.com/markcallen/env-secrets)
