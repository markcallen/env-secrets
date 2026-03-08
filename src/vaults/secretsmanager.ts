import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import Debug from 'debug';
import { buildAwsClientConfig } from './aws-config';
import { parseEnvSecrets } from '../cli/helpers';

const debug = Debug('env-secrets:secretsmanager');

interface secretsmanagerType {
  secret: string;
  profile?: string;
  region?: string;
}

interface AWSLikeError {
  name?: string;
  message?: string;
}

type SecretValue = string | number | boolean;

const isSecretValue = (value: unknown): value is SecretValue => {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
};

const asSecretRecord = (value: unknown): Record<string, SecretValue> => {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value).reduce<Record<string, SecretValue>>(
    (result, [key, entryValue]) => {
      if (isSecretValue(entryValue)) {
        result[key] = entryValue;
      }

      return result;
    },
    {}
  );
};

const parseSecretString = (
  secretvalue: string
): Record<string, SecretValue> => {
  try {
    return asSecretRecord(JSON.parse(secretvalue));
  } catch {
    try {
      const parsedEnv = parseEnvSecrets(secretvalue);
      if (parsedEnv.entries.length === 0) {
        return {};
      }

      return Object.fromEntries(
        parsedEnv.entries.map((entry) => [entry.key, entry.value])
      );
    } catch {
      return {};
    }
  }
};

const isCredentialsError = (error: unknown): error is AWSLikeError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errorName = 'name' in error ? error.name : undefined;
  return (
    errorName === 'CredentialsError' || errorName === 'CredentialsProviderError'
  );
};

const checkConnection = async (
  config: ReturnType<typeof buildAwsClientConfig>
) => {
  const stsClient = new STSClient(config);
  const command = new GetCallerIdentityCommand({});

  try {
    const data = await stsClient.send(command);
    debug(data);
    return true;
  } catch (err) {
    if (isCredentialsError(err) && err.message) {
      // eslint-disable-next-line no-console
      console.error(err.message);
      return false;
    }

    // eslint-disable-next-line no-console
    console.error(err);
    return false;
  }
};

export const secretsmanager = async (options: secretsmanagerType) => {
  const { secret, profile, region } = options;
  const config = buildAwsClientConfig({ profile, region });

  if (profile) {
    debug(`Using profile: ${profile}`);
  } else if (config.credentials) {
    debug('Using profile: default');
  } else {
    debug('Using environment variables');
  }

  if (!config.region) {
    debug('no region set');
  }

  const connected = await checkConnection(config);

  if (connected) {
    const client = new SecretsManagerClient(config);

    try {
      const command = new GetSecretValueCommand({
        SecretId: secret
      });
      const response = await client.send(command);
      const secretvalue = response.SecretString;

      if (secretvalue) {
        return parseSecretString(secretvalue);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err) {
        if (err.name === 'ResourceNotFoundException') {
          // eslint-disable-next-line no-console
          console.error(`${secret} not found`);
        } else if (err.name === 'ConfigError' && 'message' in err) {
          // eslint-disable-next-line no-console
          console.error(err.message);
        } else {
          // eslint-disable-next-line no-console
          console.error(err);
        }
      } else {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    }

    return {};
  } else {
    // eslint-disable-next-line no-console
    console.error('Unable to connect to AWS');
    return {};
  }
};
