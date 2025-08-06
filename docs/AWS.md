# AWS Integration Guide

This guide explains how to configure and use AWS Secrets Manager with the `env-secrets` tool.

## Overview

The `env-secrets` tool supports AWS Secrets Manager as a secret vault. It can retrieve secrets stored in AWS Secrets Manager and inject them as environment variables into your running applications.

## Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/index.html) installed and configured
- AWS credentials with appropriate permissions to access Secrets Manager
- Node.js 18.0.0 or higher

## Authentication Methods

There are several ways to authenticate with AWS when using `env-secrets`:

### 1. IAM Identity Center (Recommended)

IAM Identity Center (formerly AWS SSO) is the recommended authentication method for most use cases.

**Setup:**

1. Configure AWS CLI with IAM Identity Center:
   ```bash
   aws configure sso
   ```
2. Follow the prompts to set up your SSO configuration
3. Login to your SSO session:
   ```bash
   aws sso login
   ```

**Usage:**

```bash
env-secrets aws -s my-secret-name -r us-east-1 -- echo "Hello, ${USER_NAME}!"
```

**Benefits:**

- Works from any machine
- No long-term credentials to manage
- Automatic credential rotation
- Centralized access management

**Documentation:** [AWS CLI SSO Configuration](https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html)

### 2. IAM Roles

IAM roles are primarily used for accessing AWS from EC2 instances, ECS tasks, or other AWS services.

**Setup:**

1. Create an IAM role with appropriate Secrets Manager permissions
2. Attach the role to your EC2 instance or ECS task
3. The AWS SDK will automatically use the instance metadata service

**Usage:**

```bash
env-secrets aws -s my-secret-name -r us-east-1 -- node app.js
```

**Benefits:**

- No credentials to manage
- Automatic credential rotation
- Secure for production workloads

**Documentation:** [AWS CLI Role Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html)

### 3. IAM Users (Not Recommended)

IAM users with access keys should only be used for development or testing purposes.

**Setup:**

1. Create an IAM user with appropriate permissions
2. Generate access keys for the user
3. Configure credentials using one of the methods below

#### Option A: AWS Profile

```bash
aws configure --profile my-profile
```

Enter the following when prompted:

- Access Key ID
- Secret Access Key
- Default region (e.g., `us-east-1`)
- Output format: `json`

**Usage:**

```bash
env-secrets aws -s my-secret-name -r us-east-1 -p my-profile -- node app.js
```

#### Option B: Environment Variables

Set the following environment variables:

```bash
export AWS_ACCESS_KEY_ID=A...E
export AWS_SECRET_ACCESS_KEY=w...Y
export AWS_DEFAULT_REGION=us-east-1
```

**Usage:**

```bash
env-secrets aws -s my-secret-name -r us-east-1 -- node app.js
```

**Security Note:** Avoid hardcoding credentials in scripts or committing them to version control.

## Required Permissions

Your AWS credentials must have the following permissions to use Secrets Manager:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:*"
    },
    {
      "Effect": "Allow",
      "Action": ["sts:GetCallerIdentity"],
      "Resource": "*"
    }
  ]
}
```

## Examples

### Basic Usage

1. **Create a secret using AWS CLI:**

   ```bash
   aws secretsmanager create-secret \
       --region us-east-1 \
       --profile my-profile \
       --name my-app-secrets \
       --description "Application secrets" \
       --secret-string '{"DATABASE_URL":"postgresql://user:pass@dbhost:5432/db","API_KEY":"abc123"}'
   ```

2. **Use the secret with env-secrets:**
   ```bash
   env-secrets aws -s my-app-secrets -r us-east-1 -p my-profile -- node app.js
   ```

### Advanced Examples

1. **Run a Node.js application with secrets:**

   ```bash
   env-secrets aws -s production-secrets -r us-west-2 -- node server.js
   ```

2. **Check environment variables:**

   ```bash
   env-secrets aws -s my-secret -r us-east-1 -p my-profile -- env | grep -E "(DATABASE_URL|API_KEY)"
   ```

3. **Use with Docker containers:**

   ```bash
   env-secrets aws -s docker-secrets -r us-east-1 -- docker run -e DATABASE_URL -e API_KEY my-app
   ```

4. **Debug mode for troubleshooting:**
   ```bash
   DEBUG=env-secrets,env-secrets:secretsmanager env-secrets aws -s my-secret -r us-east-1 -- env
   ```

## Troubleshooting

### Common Issues

1. **"Unable to connect to AWS"**

   - Verify AWS credentials are configured correctly
   - Check if the specified region is valid
   - Ensure network connectivity to AWS services
   - Verify IAM permissions include `sts:GetCallerIdentity`

2. **"Secret not found"**

   - Verify the secret name exists in the specified region
   - Check if you have permissions to access the secret
   - Ensure the secret name is correct (case-sensitive)
   - Verify the secret is in the correct AWS account

3. **"ConfigError"**

   - Verify AWS profile configuration in `~/.aws/credentials`
   - Check if environment variables are set correctly
   - Ensure IAM role permissions if using EC2/ECS
   - Verify AWS CLI is properly configured

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

### Testing Connectivity

Test your AWS connectivity before using secrets:

```bash
# Test with AWS CLI
aws sts get-caller-identity --region us-east-1

# Test with env-secrets (will show connection status)
DEBUG=env-secrets env-secrets aws -s test-secret -r us-east-1 -- echo "Connection test"
```

## Security Best Practices

1. **Use IAM Identity Center** for most use cases
2. **Use IAM roles** for production workloads on AWS
3. **Rotate credentials regularly** if using IAM users
4. **Use least privilege** - only grant necessary permissions
5. **Enable CloudTrail** for audit logging
6. **Use VPC endpoints** for enhanced security in production
7. **Never commit credentials** to version control

## Related Documentation

- [AWS Secrets Manager User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/)
- [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
