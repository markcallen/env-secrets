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

  const myPromise = new Promise((resolve, reject) => {
    sts.getCallerIdentity({}, (err, data) => {
      if (err) reject(err);
      else {
        resolve(data);
      }
    });
  });

  let value;
  let err;

  await myPromise
    .then((v) => {
      value = v;
    })
    .catch((e) => {
      err = e;
    });

  if (err) {
    console.error(err);
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
    console.log(`Using profile: ${profile}`);
    const credentials = new AWS.SharedIniFileCredentials({
      profile
    });
    AWS.config.credentials = credentials;
  } else if (awsAccessKeyId && awsSecretAccessKey) {
    console.log('Using environment variables');
  } else {
    console.log('Using profile: default');
  }

  if (region) {
    AWS.config.update({ region });
  }
  if (!AWS.config.region) {
    console.log('no region set');
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
  }
};
