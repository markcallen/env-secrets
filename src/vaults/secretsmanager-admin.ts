import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  ListSecretsCommand,
  SecretsManagerClient,
  Tag,
  UpdateSecretCommand
} from '@aws-sdk/client-secrets-manager';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import Debug from 'debug';
import { buildAwsClientConfig } from './aws-config';

const debug = Debug('env-secrets:secretsmanager-admin');

export interface AwsSecretCommandOptions {
  profile?: string;
  region?: string;
}

export interface SecretCreateOptions extends AwsSecretCommandOptions {
  name: string;
  value: string;
  description?: string;
  kmsKeyId?: string;
  tags?: string[];
}

export interface SecretUpdateOptions extends AwsSecretCommandOptions {
  name: string;
  value?: string;
  description?: string;
  kmsKeyId?: string;
}

export interface SecretListOptions extends AwsSecretCommandOptions {
  prefix?: string;
  tags?: string[];
}

export interface SecretDeleteOptions extends AwsSecretCommandOptions {
  name: string;
  recoveryDays?: number;
  forceDeleteWithoutRecovery?: boolean;
}

export interface SecretSummary {
  name: string;
  arn?: string;
  description?: string;
  lastChangedDate?: string;
}

export interface SecretMetadata {
  name?: string;
  arn?: string;
  description?: string;
  kmsKeyId?: string;
  deletedDate?: string;
  lastChangedDate?: string;
  lastAccessedDate?: string;
  createdDate?: string;
  versionIdsToStages?: Record<string, string[]>;
  tags?: Record<string, string>;
}

interface AWSLikeError {
  name?: string;
  message?: string;
}

// Allowed characters are documented by AWS Secrets Manager naming rules.
// See: https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_limits.html
const SECRET_NAME_PATTERN = /^[A-Za-z0-9/_+=.@-]+$/;

const formatDate = (value?: Date): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value.toISOString();
};

const parseTags = (tags?: string[]): Tag[] | undefined => {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  return tags.map((tag) => {
    const parts = tag.split('=');
    if (parts.length < 2) {
      throw new Error(`Invalid tag format: ${tag}. Use key=value.`);
    }

    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();

    if (!key || !value) {
      throw new Error(`Invalid tag format: ${tag}. Use key=value.`);
    }

    return { Key: key, Value: value };
  });
};

const tagsToRecord = (tags?: Tag[]): Record<string, string> | undefined => {
  if (!tags || tags.length === 0) {
    return undefined;
  }

  const result: Record<string, string> = {};
  for (const tag of tags) {
    if (tag.Key && tag.Value) {
      result[tag.Key] = tag.Value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

const mapAwsError = (error: unknown, secretName?: string): never => {
  const awsError = error as AWSLikeError;
  const secretLabel = secretName ? ` for "${secretName}"` : '';

  if (awsError?.name === 'AlreadyExistsException') {
    throw new Error(`Secret${secretLabel} already exists.`);
  }

  if (awsError?.name === 'ResourceNotFoundException') {
    throw new Error(`Secret${secretLabel} was not found.`);
  }

  if (awsError?.name === 'InvalidRequestException') {
    throw new Error(
      awsError.message || 'Invalid request to AWS Secrets Manager.'
    );
  }

  if (awsError?.name === 'AccessDeniedException') {
    throw new Error(
      awsError.message ||
        'Access denied while calling AWS Secrets Manager. Verify IAM permissions.'
    );
  }

  if (awsError?.message) {
    throw new Error(awsError.message);
  }

  throw new Error(String(error));
};

const ensureConnected = async (
  clientConfig: ReturnType<typeof buildAwsClientConfig>
) => {
  const stsClient = new STSClient(clientConfig);
  await stsClient.send(new GetCallerIdentityCommand({}));
};

const createClient = async (options: AwsSecretCommandOptions) => {
  const config = buildAwsClientConfig(options);
  debug('Creating AWS clients', {
    hasProfile: Boolean(options.profile),
    region: options.region,
    hasEndpoint: Boolean(config.endpoint)
  });
  await ensureConnected(config);
  return new SecretsManagerClient(config);
};

export const validateSecretName = (name: string) => {
  if (!SECRET_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid secret name "${name}". Use only letters, numbers, and /_+=.@- characters.`
    );
  }
};

export const createSecret = async (
  options: SecretCreateOptions
): Promise<{ arn?: string; name?: string; versionId?: string }> => {
  validateSecretName(options.name);
  debug('createSecret called', {
    name: options.name,
    hasTags: !!options.tags?.length
  });

  const client = await createClient(options);
  const tags = parseTags(options.tags);

  try {
    const result = await client.send(
      new CreateSecretCommand({
        Name: options.name,
        Description: options.description,
        SecretString: options.value,
        KmsKeyId: options.kmsKeyId,
        Tags: tags
      })
    );

    return {
      arn: result.ARN,
      name: result.Name,
      versionId: result.VersionId
    };
  } catch (error: unknown) {
    return mapAwsError(error, options.name);
  }
};

export const updateSecret = async (
  options: SecretUpdateOptions
): Promise<{ arn?: string; name?: string; versionId?: string }> => {
  validateSecretName(options.name);
  debug('updateSecret called', { name: options.name });

  const client = await createClient(options);

  try {
    const result = await client.send(
      new UpdateSecretCommand({
        SecretId: options.name,
        Description: options.description,
        SecretString: options.value,
        KmsKeyId: options.kmsKeyId
      })
    );

    return {
      arn: result.ARN,
      name: result.Name,
      versionId: result.VersionId
    };
  } catch (error: unknown) {
    return mapAwsError(error, options.name);
  }
};

export const listSecrets = async (
  options: SecretListOptions
): Promise<SecretSummary[]> => {
  debug('listSecrets called', {
    prefix: options.prefix,
    hasTags: !!options.tags?.length
  });
  const client = await createClient(options);
  const requiredTags = parseTags(options.tags);
  const secrets: SecretSummary[] = [];

  try {
    let nextToken: string | undefined;

    do {
      const result = await client.send(
        new ListSecretsCommand({ NextToken: nextToken })
      );

      for (const secret of result.SecretList || []) {
        if (
          options.prefix &&
          secret.Name &&
          !secret.Name.startsWith(options.prefix)
        ) {
          continue;
        }

        if (requiredTags && requiredTags.length > 0) {
          const available = tagsToRecord(secret.Tags);
          const matchesAll = requiredTags.every(
            (tag) => tag.Key && tag.Value && available?.[tag.Key] === tag.Value
          );
          if (!matchesAll) {
            continue;
          }
        }

        secrets.push({
          name: secret.Name || '',
          arn: secret.ARN,
          description: secret.Description,
          lastChangedDate: formatDate(secret.LastChangedDate)
        });
      }

      nextToken = result.NextToken;
    } while (nextToken);
  } catch (error: unknown) {
    return mapAwsError(error);
  }

  return secrets;
};

export const getSecretMetadata = async (
  options: AwsSecretCommandOptions & { name: string }
): Promise<SecretMetadata> => {
  validateSecretName(options.name);
  debug('getSecretMetadata called', { name: options.name });
  const client = await createClient(options);

  try {
    const result = await client.send(
      new DescribeSecretCommand({ SecretId: options.name })
    );

    return {
      name: result.Name,
      arn: result.ARN,
      description: result.Description,
      kmsKeyId: result.KmsKeyId,
      deletedDate: formatDate(result.DeletedDate),
      lastChangedDate: formatDate(result.LastChangedDate),
      lastAccessedDate: formatDate(result.LastAccessedDate),
      createdDate: formatDate(result.CreatedDate),
      versionIdsToStages: result.VersionIdsToStages,
      tags: tagsToRecord(result.Tags)
    };
  } catch (error: unknown) {
    return mapAwsError(error, options.name);
  }
};

export const deleteSecret = async (
  options: SecretDeleteOptions
): Promise<{ arn?: string; name?: string; deletedDate?: string }> => {
  validateSecretName(options.name);
  debug('deleteSecret called', {
    name: options.name,
    recoveryDays: options.recoveryDays,
    forceDeleteWithoutRecovery: options.forceDeleteWithoutRecovery
  });
  const client = await createClient(options);

  try {
    const result = await client.send(
      new DeleteSecretCommand({
        SecretId: options.name,
        RecoveryWindowInDays: options.recoveryDays,
        ForceDeleteWithoutRecovery: options.forceDeleteWithoutRecovery
      })
    );

    return {
      arn: result.ARN,
      name: result.Name,
      deletedDate: formatDate(result.DeletionDate)
    };
  } catch (error: unknown) {
    return mapAwsError(error, options.name);
  }
};
