# env-secrets

Get secrets from a vault and inject them as environment variables

## Setup

Install node

## Debug

Use debug-js pass in env-secrets for the main application and env-secrets:<vault> for vault specific debugging

```
DEBUG=env-secrets,env-secrets:secretsmanager npx ts-node src/index.ts aws -s local/sample -r ca-central-1 -p marka -- env
```
