import { fromIni } from '@aws-sdk/credential-providers';

interface AwsConfigOptions {
  profile?: string;
  region?: string;
}

interface AwsClientConfig {
  region?: string;
  credentials?: ReturnType<typeof fromIni>;
  endpoint?: string;
}

const getCredentialsProvider = (options: AwsConfigOptions) => {
  const {
    AWS_ACCESS_KEY_ID: awsAccessKeyId,
    AWS_SECRET_ACCESS_KEY: awsSecretAccessKey
  } = process.env;

  if (options.profile) {
    return fromIni({ profile: options.profile });
  }

  if (awsAccessKeyId && awsSecretAccessKey) {
    return undefined;
  }

  return fromIni({ profile: 'default' });
};

const getEndpoint = () => {
  return (
    process.env.AWS_ENDPOINT_URL || process.env.AWS_SECRETS_MANAGER_ENDPOINT
  );
};

export const buildAwsClientConfig = (
  options: AwsConfigOptions
): AwsClientConfig => {
  const endpoint = getEndpoint();
  const config: AwsClientConfig = {
    region: options.region,
    credentials: getCredentialsProvider(options)
  };

  if (endpoint) {
    config.endpoint = endpoint;
  }

  return config;
};
