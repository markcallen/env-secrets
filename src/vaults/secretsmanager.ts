import AWS from 'aws-sdk';
import Debug from 'debug';

const debug = Debug('env-secrets:secretsmanager');

interface secretsmanagerType {
  secret: string;
  profile?: string;
  region?: string;
}

const checkConnection = async () => {
  const sts = new AWS.STS();

  const getCallerPromise = new Promise((resolve, reject) => {
    sts.getCallerIdentity({}, (err, data) => {
      if (err) reject(err);
      else {
        resolve(data);
      }
    });
  });

  let value;
  let err;

  await getCallerPromise
    .then((v) => {
      value = v;
    })
    .catch((e) => {
      err = e;
    });

  if (err) {
    console.error(err);
    return false;
  }
  debug(value);

  return !!value;
};

export const secretsmanager = async (options: secretsmanagerType) => {
  const { secret, profile, region } = options;
  const {
    AWS_ACCESS_KEY_ID: awsAccessKeyId,
    AWS_SECRET_ACCESS_KEY: awsSecretAccessKey
  } = process.env;
  if (profile) {
    debug(`Using profile: ${profile}`);
    const credentials = new AWS.SharedIniFileCredentials({
      profile
    });
    AWS.config.credentials = credentials;
  } else if (awsAccessKeyId && awsSecretAccessKey) {
    debug('Using environment variables');
  } else {
    debug('Using profile: default');
  }

  if (region) {
    AWS.config.update({ region });
  }
  if (!AWS.config.region) {
    debug('no region set');
  }

  const connected = await checkConnection();

  if (connected) {
    const sm = new AWS.SecretsManager();

    try {
      const response = await sm
        .getSecretValue({
          SecretId: secret
        })
        .promise();

      const secretvalue = response.SecretString;

      try {
        if (secretvalue) {
          return JSON.parse(secretvalue);
        }
      } catch (err) {
        console.error(err);
      }
    } catch (err: any) {
      if (err && err.code === 'ResourceNotFoundException') {
        console.error(`${secret} not found`);
      } else if (err && err.code === 'ConfigError') {
        console.error(err.message);
      } else {
        console.error(err);
      }
    }

    return {};
  } else {
    console.error('Unable to connect to AWS');
  }
};
