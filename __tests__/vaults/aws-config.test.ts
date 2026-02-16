import { fromIni } from '@aws-sdk/credential-providers';

jest.mock('@aws-sdk/credential-providers');

import { buildAwsClientConfig } from '../../src/vaults/aws-config';

const mockFromIni = fromIni as jest.MockedFunction<typeof fromIni>;

describe('aws-config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses explicit profile when provided', () => {
    const mockCredentials = jest.fn();
    mockFromIni.mockReturnValue(mockCredentials as ReturnType<typeof fromIni>);

    const config = buildAwsClientConfig({
      profile: 'my-profile',
      region: 'us-east-1'
    });

    expect(mockFromIni).toHaveBeenCalledWith({ profile: 'my-profile' });
    expect(config).toEqual({
      region: 'us-east-1',
      credentials: mockCredentials
    });
  });

  it('uses environment credentials when access key and secret are present', () => {
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';

    const config = buildAwsClientConfig({ region: 'us-east-1' });

    expect(mockFromIni).not.toHaveBeenCalled();
    expect(config).toEqual({
      region: 'us-east-1',
      credentials: undefined
    });
  });

  it('falls back to default profile when no explicit credentials are provided', () => {
    const mockCredentials = jest.fn();
    mockFromIni.mockReturnValue(mockCredentials as ReturnType<typeof fromIni>);

    const config = buildAwsClientConfig({ region: 'us-east-1' });

    expect(mockFromIni).toHaveBeenCalledWith({ profile: 'default' });
    expect(config).toEqual({
      region: 'us-east-1',
      credentials: mockCredentials
    });
  });

  it('prefers AWS_ENDPOINT_URL for custom endpoint', () => {
    const mockCredentials = jest.fn();
    mockFromIni.mockReturnValue(mockCredentials as ReturnType<typeof fromIni>);
    process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
    process.env.AWS_SECRETS_MANAGER_ENDPOINT = 'http://localhost:4577';

    const config = buildAwsClientConfig({ region: 'us-east-1' });

    expect(config.endpoint).toBe('http://localhost:4566');
  });

  it('uses AWS_SECRETS_MANAGER_ENDPOINT when AWS_ENDPOINT_URL is unset', () => {
    const mockCredentials = jest.fn();
    mockFromIni.mockReturnValue(mockCredentials as ReturnType<typeof fromIni>);
    delete process.env.AWS_ENDPOINT_URL;
    process.env.AWS_SECRETS_MANAGER_ENDPOINT = 'http://localhost:4577';

    const config = buildAwsClientConfig({ region: 'us-east-1' });

    expect(config.endpoint).toBe('http://localhost:4577');
  });
});
