import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import Debug from 'debug';
import { buildAwsClientConfig } from './aws-config';

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

      try {
        if (secretvalue) {
          return JSON.parse(secretvalue);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
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
