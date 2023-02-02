# env-secrets

Get secrets from a vault and inject them as environment variables

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

AWS

```
env-secrets aws -s <secret name> -r <region> -p <profile> -- <program to run>
```

`<secret name>` is the name of the secret in Secrets Manager

`<region>` is the region where the secret to stored. It is optional, the AWS_DEFAULT_REGION environment variable will be used instead.

`<profile>` is the local aws profile to use. It is optional, the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables will be used instead.

example:

```
env-secrets aws -s local/sample -r us-east-1 -p marka -- env
```

Create a Secret using AWS cli

```
aws secretsmanager create-secret \
    --region us-east-1 \
    --profile marka \
    --name local/sample \
    --description "local/sample secret" \
    --secret-string "{\"user\":\"marka\",\"password\":\"mypassword\"}"
```

## Debug

Uses debug-js to show debug logs by passing in env-secrets for the main application
and env-secrets:<vault> for vault specific debugging

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
