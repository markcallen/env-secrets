import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { STSClient } from '@aws-sdk/client-sts';
import { fromIni } from '@aws-sdk/credential-providers';

// Mock send functions - must be declared before jest.mock calls
const mockSecretsManagerSend = jest.fn();
const mockSTSSend = jest.fn();

// Mock the AWS SDK and dependencies
jest.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: mockSecretsManagerSend
    })),
    GetSecretValueCommand: jest.fn().mockImplementation((input) => ({
      input
    }))
  };
});

jest.mock('@aws-sdk/client-sts', () => {
  return {
    STSClient: jest.fn().mockImplementation(() => ({
      send: mockSTSSend
    })),
    GetCallerIdentityCommand: jest.fn().mockImplementation((input) => ({
      input
    }))
  };
});

jest.mock('@aws-sdk/credential-providers');
jest.mock('debug', () => {
  const mockDebug = jest.fn();
  mockDebug.mockReturnValue(jest.fn());
  return mockDebug;
});

// Import the module under test after mocking
import { secretsmanager } from '../../src/vaults/secretsmanager';

// Type the mocked functions
const mockSecretsManagerClient = SecretsManagerClient as jest.MockedClass<
  typeof SecretsManagerClient
>;
const mockSTSClient = STSClient as jest.MockedClass<typeof STSClient>;
const mockFromIni = fromIni as jest.MockedFunction<typeof fromIni>;

describe('secretsmanager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset process.env
    originalEnv = { ...process.env };
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('AWS connection', () => {
    it('should successfully connect to AWS and retrieve secrets', async () => {
      // Mock successful STS connection
      mockSTSSend.mockResolvedValueOnce({
        Account: '123456789012',
        UserId: 'test-user'
      });

      // Mock successful secret retrieval
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString:
          '{"API_KEY": "test-key", "DATABASE_URL": "postgres://localhost:5432/db"}'
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(mockSTSSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: {} })
      );
      expect(mockSecretsManagerSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: expect.anything() })
      );
      expect(result).toEqual({
        API_KEY: 'test-key',
        DATABASE_URL: 'postgres://localhost:5432/db'
      });
    });

    it('should return empty object when AWS connection fails', async () => {
      // Mock failed STS connection
      mockSTSSend.mockRejectedValueOnce(new Error('AWS credentials not found'));

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(mockSTSSend).toHaveBeenCalledWith(
        expect.objectContaining({ input: {} })
      );
      expect(mockSecretsManagerSend).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('credential handling', () => {
    beforeEach(() => {
      // Setup successful connection for credential tests
      mockSTSSend.mockResolvedValue({
        Account: '123456789012'
      });
    });

    it('should use profile credentials when profile is provided', async () => {
      const mockCredentials = jest.fn().mockResolvedValue({
        accessKeyId: 'test',
        secretAccessKey: 'test'
      });
      mockFromIni.mockReturnValueOnce(mockCredentials);

      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"KEY": "value"}'
      });

      await secretsmanager({
        secret: 'test-secret',
        profile: 'my-profile',
        region: 'us-east-1'
      });

      expect(mockFromIni).toHaveBeenCalledWith({ profile: 'my-profile' });
      expect(mockSecretsManagerClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: mockCredentials
      });
    });

    it('should use environment variables when AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'env-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'env-secret-key';

      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"KEY": "value"}'
      });

      await secretsmanager({
        secret: 'test-secret',
        region: 'us-east-1'
      });

      expect(mockSecretsManagerClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: undefined
      });
    });

    it('should use default profile when no profile or environment variables are provided', async () => {
      const mockCredentials = jest.fn().mockResolvedValue({
        accessKeyId: 'default',
        secretAccessKey: 'default'
      });
      mockFromIni.mockReturnValueOnce(mockCredentials);

      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"KEY": "value"}'
      });

      await secretsmanager({
        secret: 'test-secret',
        region: 'us-east-1'
      });

      expect(mockFromIni).toHaveBeenCalledWith({ profile: 'default' });
      expect(mockSecretsManagerClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: mockCredentials
      });
    });
  });

  describe('secret retrieval', () => {
    beforeEach(() => {
      // Setup successful connection for secret retrieval tests
      mockSTSSend.mockResolvedValue({
        Account: '123456789012'
      });
    });

    it('should retrieve and parse JSON secret successfully', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString:
          '{"API_KEY": "test-api-key", "DATABASE_URL": "postgres://localhost:5432/db"}'
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({
        API_KEY: 'test-api-key',
        DATABASE_URL: 'postgres://localhost:5432/db'
      });
    });

    it('should handle non-JSON secret values', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: 'plain-text-secret'
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle empty secret values', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: ''
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle undefined secret values', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: undefined
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle malformed JSON in secret values', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"invalid": json}'
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle secrets with special characters', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"SPECIAL_KEY": "value with spaces & symbols!@#$%"}'
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({
        SPECIAL_KEY: 'value with spaces & symbols!@#$%'
      });
    });

    it('should handle secrets with numeric and boolean values', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"PORT": 5432, "DEBUG": true, "TIMEOUT": 30000}'
      });

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({
        PORT: 5432,
        DEBUG: true,
        TIMEOUT: 30000
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Setup successful connection for error handling tests
      mockSTSSend.mockResolvedValue({
        Account: '123456789012'
      });
    });

    it('should handle ResourceNotFoundException', async () => {
      const error = new Error('Secret not found');
      (error as any).name = 'ResourceNotFoundException';

      mockSecretsManagerSend.mockRejectedValueOnce(error);

      const result = await secretsmanager({
        secret: 'non-existent-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle ConfigError', async () => {
      const error = new Error('Invalid configuration');
      (error as any).name = 'ConfigError';
      (error as any).message = 'Invalid AWS configuration';

      mockSecretsManagerSend.mockRejectedValueOnce(error);

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle generic AWS errors', async () => {
      const error = new Error('Generic AWS error');
      (error as any).name = 'GenericError';

      mockSecretsManagerSend.mockRejectedValueOnce(error);

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle errors without name property', async () => {
      const error = new Error('Error without name');

      mockSecretsManagerSend.mockRejectedValueOnce(error);

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });

    it('should handle non-Error objects', async () => {
      const error = 'String error';

      mockSecretsManagerSend.mockRejectedValueOnce(error);

      const result = await secretsmanager({
        secret: 'my-secret',
        region: 'us-east-1'
      });

      expect(result).toEqual({});
    });
  });

  describe('region handling', () => {
    beforeEach(() => {
      mockSTSSend.mockResolvedValue({
        Account: '123456789012'
      });
    });

    it('should use provided region', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"KEY": "value"}'
      });

      await secretsmanager({
        secret: 'my-secret',
        region: 'ap-southeast-1'
      });

      expect(mockSecretsManagerClient).toHaveBeenCalledWith({
        region: 'ap-southeast-1',
        credentials: undefined
      });
    });

    it('should handle undefined region', async () => {
      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"KEY": "value"}'
      });

      await secretsmanager({
        secret: 'my-secret'
      });

      expect(mockSecretsManagerClient).toHaveBeenCalledWith({
        region: undefined,
        credentials: undefined
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete successful flow with profile credentials', async () => {
      const mockCredentials = jest.fn().mockResolvedValue({
        accessKeyId: 'test',
        secretAccessKey: 'test'
      });
      mockFromIni.mockReturnValueOnce(mockCredentials);

      mockSTSSend.mockResolvedValueOnce({
        Account: '123456789012',
        UserId: 'test-user'
      });

      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"API_KEY": "test-key", "DB_PASSWORD": "secret123"}'
      });

      const result = await secretsmanager({
        secret: 'my-app-secrets',
        profile: 'production',
        region: 'us-west-2'
      });

      expect(mockFromIni).toHaveBeenCalledWith({ profile: 'production' });
      expect(mockSTSClient).toHaveBeenCalledWith({ region: 'us-west-2' });
      expect(mockSecretsManagerClient).toHaveBeenCalledWith({
        region: 'us-west-2',
        credentials: mockCredentials
      });
      expect(result).toEqual({
        API_KEY: 'test-key',
        DB_PASSWORD: 'secret123'
      });
    });

    it('should handle complete flow with environment variables', async () => {
      process.env.AWS_ACCESS_KEY_ID = 'env-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'env-secret';

      mockSTSSend.mockResolvedValueOnce({
        Account: '123456789012'
      });

      mockSecretsManagerSend.mockResolvedValueOnce({
        SecretString: '{"ENV_VAR": "env-value"}'
      });

      const result = await secretsmanager({
        secret: 'env-secrets',
        region: 'eu-central-1'
      });

      expect(result).toEqual({ ENV_VAR: 'env-value' });
    });
  });
});
