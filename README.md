# env-secrets

Get secrets from a vault and inject them as environment variables

## Setup

Install node

## Installation

```
npm install -g env-secrets
```

## Usage

AWS

```
env-secrets aws -s <secret name> -r <region> -p <profile> -- <program to run>
```

`<secret name>` is the name of the secret in Secrets Manager

`<region>` is the region where the secret to stored. It is optional with the AWS_DEFAULT_REGION environment variable will be used instead.

`<profile>` is the local aws profile to use. It is optional with the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables will be used if its not used.

example:

```
env-secrets aws -s local/sample -r ca-central-1 -p marka -- env
```

## Debug

Uses debug-js to show debug logs by passing in env-secrets for the main application
and env-secrets:<vault> for vault specific debugging

```
DEBUG=env-secrets,env-secrets:secretsmanager npx ts-node src/index.ts aws -s local/sample -r ca-central-1 -p marka -- env
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
