import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { STSClient } from '@aws-sdk/client-sts';
import { fromIni } from '@aws-sdk/credential-providers';

const mockSecretsManagerSend = jest.fn();
const mockSTSSend = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: mockSecretsManagerSend
    })),
    CreateSecretCommand: jest.fn().mockImplementation((input) => ({ input })),
    UpdateSecretCommand: jest.fn().mockImplementation((input) => ({ input })),
    ListSecretsCommand: jest.fn().mockImplementation((input) => ({ input })),
    DescribeSecretCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteSecretCommand: jest.fn().mockImplementation((input) => ({ input }))
  };
});

jest.mock('@aws-sdk/client-sts', () => {
  return {
    STSClient: jest.fn().mockImplementation(() => ({
      send: mockSTSSend
    })),
    GetCallerIdentityCommand: jest
      .fn()
      .mockImplementation((input) => ({ input }))
  };
});

jest.mock('@aws-sdk/credential-providers');

import {
  createSecret,
  updateSecret,
  listSecrets,
  getSecretMetadata,
  deleteSecret,
  validateSecretName
} from '../../src/vaults/secretsmanager-admin';

const mockSecretsManagerClient = SecretsManagerClient as jest.MockedClass<
  typeof SecretsManagerClient
>;
const mockSTSClient = STSClient as jest.MockedClass<typeof STSClient>;
const mockFromIni = fromIni as jest.MockedFunction<typeof fromIni>;

describe('secretsmanager-admin', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    process.env = { ...originalEnv };
    mockSTSSend.mockResolvedValue({ Account: '123456789012' });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates secret names', () => {
    expect(() => validateSecretName('valid/name_1')).not.toThrow();
    expect(() => validateSecretName('invalid name')).toThrow(
      'Invalid secret name'
    );
  });

  it('creates a secret with tags', async () => {
    mockSecretsManagerSend.mockResolvedValueOnce({
      Name: 'test-secret',
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret',
      VersionId: 'v1'
    });

    const result = await createSecret({
      name: 'test-secret',
      value: '{"API_KEY":"abc"}',
      description: 'test',
      tags: ['team=platform', 'env=dev'],
      region: 'us-east-1'
    });

    expect(mockSTSClient).toHaveBeenCalled();
    expect(mockSecretsManagerClient).toHaveBeenCalled();
    expect(mockSecretsManagerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Name: 'test-secret',
          SecretString: '{"API_KEY":"abc"}',
          Tags: [
            { Key: 'team', Value: 'platform' },
            { Key: 'env', Value: 'dev' }
          ]
        })
      })
    );
    expect(result).toEqual({
      arn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret',
      name: 'test-secret',
      versionId: 'v1'
    });
  });

  it('supports tags with multiple equals signs', async () => {
    mockSecretsManagerSend.mockResolvedValueOnce({
      Name: 'test-secret',
      ARN: 'arn:test',
      VersionId: 'v1'
    });

    await createSecret({
      name: 'test-secret',
      value: 'value',
      tags: ['url=https://example.com?a=1'],
      region: 'us-east-1'
    });

    expect(mockSecretsManagerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Tags: [{ Key: 'url', Value: 'https://example.com?a=1' }]
        })
      })
    );
  });

  it('throws for malformed tags', async () => {
    await expect(
      createSecret({
        name: 'test-secret',
        value: 'value',
        tags: ['invalid-tag'],
        region: 'us-east-1'
      })
    ).rejects.toThrow('Invalid tag format');
  });

  it('omits tags when none are provided', async () => {
    mockSecretsManagerSend.mockResolvedValueOnce({
      Name: 'test-secret',
      ARN: 'arn:test',
      VersionId: 'v1'
    });

    await createSecret({
      name: 'test-secret',
      value: 'value',
      region: 'us-east-1'
    });

    expect(mockSecretsManagerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Tags: undefined
        })
      })
    );
  });

  it('maps create secret AlreadyExistsException', async () => {
    mockSecretsManagerSend.mockRejectedValueOnce({
      name: 'AlreadyExistsException'
    });

    await expect(
      createSecret({
        name: 'existing-secret',
        value: 'abc',
        region: 'us-east-1'
      })
    ).rejects.toThrow('already exists');
  });

  it('updates a secret value and description', async () => {
    mockSecretsManagerSend.mockResolvedValueOnce({
      Name: 'test-secret',
      ARN: 'arn:test',
      VersionId: 'v2'
    });

    const result = await updateSecret({
      name: 'test-secret',
      value: '{"API_KEY":"new"}',
      description: 'updated',
      region: 'us-east-1'
    });

    expect(mockSecretsManagerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          SecretId: 'test-secret',
          SecretString: '{"API_KEY":"new"}',
          Description: 'updated'
        })
      })
    );
    expect(result.versionId).toBe('v2');
  });

  it('lists secrets and applies prefix/tag filters', async () => {
    mockSecretsManagerSend.mockResolvedValueOnce({
      SecretList: [
        {
          Name: 'app/one',
          Description: 'One',
          Tags: [{ Key: 'env', Value: 'dev' }],
          LastChangedDate: new Date('2026-02-16T00:00:00.000Z')
        },
        {
          Name: 'app/two',
          Description: 'Two',
          Tags: [{ Key: 'env', Value: 'prod' }],
          LastChangedDate: new Date('2026-02-16T00:00:00.000Z')
        }
      ]
    });

    const result = await listSecrets({
      prefix: 'app/',
      tags: ['env=dev'],
      region: 'us-east-1'
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('app/one');
  });

  it('ignores invalid AWS tags during tag filtering', async () => {
    mockSecretsManagerSend.mockResolvedValueOnce({
      SecretList: [
        {
          Name: 'app/one',
          Tags: [{ Key: undefined, Value: 'dev' }]
        },
        {
          Name: 'app/two',
          Tags: [{ Key: 'env', Value: 'dev' }]
        }
      ]
    });

    const result = await listSecrets({
      tags: ['env=dev'],
      region: 'us-east-1'
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('app/two');
  });

  it('returns secret metadata without secret value', async () => {
    mockSecretsManagerSend.mockResolvedValueOnce({
      Name: 'app/meta',
      ARN: 'arn:meta',
      Description: 'Meta secret',
      KmsKeyId: 'kms-key',
      CreatedDate: new Date('2026-02-16T00:00:00.000Z'),
      LastChangedDate: new Date('2026-02-16T01:00:00.000Z'),
      VersionIdsToStages: { abc: ['AWSCURRENT'] },
      Tags: [{ Key: 'env', Value: 'dev' }]
    });

    const result = await getSecretMetadata({
      name: 'app/meta',
      region: 'us-east-1'
    });

    expect(result).toEqual(
      expect.objectContaining({
        name: 'app/meta',
        arn: 'arn:meta',
        tags: { env: 'dev' },
        versionIdsToStages: { abc: ['AWSCURRENT'] }
      })
    );
    expect(Object.keys(result)).not.toContain('secretString');
  });

  it('deletes secret with recovery options', async () => {
    const mockCredentials = jest.fn().mockResolvedValue({
      accessKeyId: 'default',
      secretAccessKey: 'default'
    });
    mockFromIni.mockReturnValue(mockCredentials);

    mockSecretsManagerSend.mockResolvedValueOnce({
      Name: 'app/delete',
      ARN: 'arn:delete',
      DeletionDate: new Date('2026-02-16T02:00:00.000Z')
    });

    const result = await deleteSecret({
      name: 'app/delete',
      recoveryDays: 7,
      profile: 'test-profile',
      region: 'us-east-1'
    });

    expect(mockFromIni).toHaveBeenCalledWith({ profile: 'test-profile' });
    expect(mockSecretsManagerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          SecretId: 'app/delete',
          RecoveryWindowInDays: 7
        })
      })
    );
    expect(result.name).toBe('app/delete');
  });
});
