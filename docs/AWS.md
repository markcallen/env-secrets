# AWS

Using AWS Secrets Manager as the secrect vault.

There are several different ways to access AWS from the AWS SDK

IAM Identity Center authentication
IAM Roles
IAM Users

Each way requires the use of the [AWS CLI](https://docs.aws.amazon.com/cli/index.html), optoinally for IAM Users you can use environment variables only.

## IAM Identity Center authentication

details [here](https://docs.aws.amazon.com/cli/latest/userguide/sso-configure-profile-token.html)

Useful from any machine.

## IAM Roles

details [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-role.html)

Mostly used for accessing AWS from an ec2 instance.

## IAM Users

details [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-authentication-user.html)

Not recommended.

Create access keys for your IAM user and add them to an AWS profile or environment variables.

### AWS Profile

```
aws configure --profile testuser
```

Enter the Access Key ID and Secret Access Key when prompted. Set the default region to where you want your secrets to be stored and set the output format to json.

### Environment Variables

Add the as environment variables.

```
export AWS_ACCESS_KEY_ID=A...2
export AWS_SECRET_ACCESS_KEY=N...n
export AWS_DEFAULT_REGION=us-east-1
```
