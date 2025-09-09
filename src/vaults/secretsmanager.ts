import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { fromIni } from '@aws-sdk/credential-providers';
import Debug from 'debug';

const debug = Debug('env-secrets:secretsmanager');

interface secretsmanagerType {
  secret: string;
  profile?: string;
  region?: string;
}

const checkConnection = async (region?: string) => {
  const stsClient = new STSClient({ region });
  const command = new GetCallerIdentityCommand({});

  try {
    const data = await stsClient.send(command);
    debug(data);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return false;
  }
};

export const secretsmanager = async (options: secretsmanagerType) => {
  const { secret, profile, region } = options;
  const {
    AWS_ACCESS_KEY_ID: awsAccessKeyId,
    AWS_SECRET_ACCESS_KEY: awsSecretAccessKey
  } = process.env;

  let credentials;
  if (profile) {
    debug(`Using profile: ${profile}`);
    credentials = fromIni({ profile });
  } else if (awsAccessKeyId && awsSecretAccessKey) {
    debug('Using environment variables');
    credentials = undefined; // Will use environment variables automatically
  } else {
    debug('Using profile: default');
    credentials = fromIni({ profile: 'default' });
  }

  const config = {
    region,
    credentials
  };

  if (!config.region) {
    debug('no region set');
  }

  const connected = await checkConnection(region);

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
