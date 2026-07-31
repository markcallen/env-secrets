import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  findConfigFile,
  parseConfig,
  loadConfig,
  serializeConfig,
  writeConfigFile,
  filterSecretKeys
} from '../../src/config/loader';

jest.mock('node:fs');

const mockExistsSync = fs.existsSync as jest.MockedFunction<
  typeof fs.existsSync
>;
const mockReadFileSync = fs.readFileSync as jest.MockedFunction<
  typeof fs.readFileSync
>;
const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<
  typeof fs.writeFileSync
>;

const YAML_CONFIG = `
provider: aws
profile: myprofile
region: us-west-2
secrets:
  - name: my/secret
    keys:
      - DB_PASSWORD
      - API_KEY
  - name: another/secret
`;

const JSON_CONFIG = JSON.stringify({
  provider: 'aws',
  profile: 'default',
  region: 'us-east-1',
  secrets: [{ name: 'my/secret' }]
});

describe('findConfigFile', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('returns undefined when no config file exists', () => {
    expect(findConfigFile('/tmp/project')).toBeUndefined();
  });

  it('finds .env-secrets.yml in CWD', () => {
    mockExistsSync.mockImplementation(
      (p) => p === '/tmp/project/.env-secrets.yml'
    );
    expect(findConfigFile('/tmp/project')).toBe(
      '/tmp/project/.env-secrets.yml'
    );
  });

  it('finds .env-secrets.yaml in CWD', () => {
    mockExistsSync.mockImplementation(
      (p) => p === '/tmp/project/.env-secrets.yaml'
    );
    expect(findConfigFile('/tmp/project')).toBe(
      '/tmp/project/.env-secrets.yaml'
    );
  });

  it('finds .env-secrets.json in CWD', () => {
    mockExistsSync.mockImplementation(
      (p) => p === '/tmp/project/.env-secrets.json'
    );
    expect(findConfigFile('/tmp/project')).toBe(
      '/tmp/project/.env-secrets.json'
    );
  });

  it('prefers .yml over .yaml and .json in CWD', () => {
    mockExistsSync.mockReturnValue(true);
    expect(findConfigFile('/tmp/project')).toBe(
      '/tmp/project/.env-secrets.yml'
    );
  });

  it('falls back to home directory when not in CWD', () => {
    const home = os.homedir();
    mockExistsSync.mockImplementation(
      (p) => p === path.join(home, '.env-secrets.yml')
    );
    expect(findConfigFile('/tmp/project')).toBe(
      path.join(home, '.env-secrets.yml')
    );
  });

  it('prefers CWD config over home directory config', () => {
    const home = os.homedir();
    mockExistsSync.mockImplementation(
      (p) =>
        p === '/tmp/project/.env-secrets.yml' ||
        p === path.join(home, '.env-secrets.yml')
    );
    expect(findConfigFile('/tmp/project')).toBe(
      '/tmp/project/.env-secrets.yml'
    );
  });
});

describe('parseConfig', () => {
  it('parses valid YAML config', () => {
    const config = parseConfig(YAML_CONFIG, '/tmp/.env-secrets.yml');
    expect(config).toEqual({
      provider: 'aws',
      profile: 'myprofile',
      region: 'us-west-2',
      secrets: [
        { name: 'my/secret', keys: ['DB_PASSWORD', 'API_KEY'] },
        { name: 'another/secret', keys: undefined }
      ]
    });
  });

  it('parses valid JSON config', () => {
    const config = parseConfig(JSON_CONFIG, '/tmp/.env-secrets.json');
    expect(config).toEqual({
      provider: 'aws',
      profile: 'default',
      region: 'us-east-1',
      secrets: [{ name: 'my/secret', keys: undefined }]
    });
  });

  it('parses config with no optional fields', () => {
    const minimal = `
secrets:
  - name: my/secret
`;
    const config = parseConfig(minimal, '/tmp/.env-secrets.yml');
    expect(config).toEqual({
      provider: undefined,
      profile: undefined,
      region: undefined,
      secrets: [{ name: 'my/secret', keys: undefined }]
    });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseConfig('{ bad json', '/tmp/.env-secrets.json')).toThrow(
      'not valid JSON'
    );
  });

  it('throws on invalid YAML', () => {
    expect(() =>
      parseConfig('{ bad: yaml: :', '/tmp/.env-secrets.yml')
    ).toThrow('not valid YAML');
  });

  it('throws when root is not an object', () => {
    expect(() =>
      parseConfig('- item1\n- item2', '/tmp/.env-secrets.yml')
    ).toThrow('must be a YAML/JSON object');
  });

  it('throws when provider is not a string', () => {
    const bad = `
provider: 123
secrets:
  - name: my/secret
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      '"provider" must be a string'
    );
  });

  it('throws when profile is not a string', () => {
    const bad = `
profile: 123
secrets:
  - name: my/secret
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      '"profile" must be a string'
    );
  });

  it('throws when region is not a string', () => {
    const bad = `
region: 123
secrets:
  - name: my/secret
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      '"region" must be a string'
    );
  });

  it('throws when secrets is missing', () => {
    const bad = `provider: aws`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      '"secrets" must be a non-empty array'
    );
  });

  it('throws when secrets is empty', () => {
    const bad = `
secrets: []
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      '"secrets" must be a non-empty array'
    );
  });

  it('throws when a secret entry is not an object', () => {
    const bad = `
secrets:
  - just-a-string
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      'secrets[0] must be an object'
    );
  });

  it('throws when secret name is missing', () => {
    const bad = `
secrets:
  - keys:
      - DB_PASSWORD
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      'secrets[0].name must be a non-empty string'
    );
  });

  it('throws when secret name is empty', () => {
    const bad = `
secrets:
  - name: ""
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      'secrets[0].name must be a non-empty string'
    );
  });

  it('throws when keys contains non-string values', () => {
    const bad = `
secrets:
  - name: my/secret
    keys:
      - 123
`;
    expect(() => parseConfig(bad, '/tmp/.env-secrets.yml')).toThrow(
      'secrets[0].keys must be an array of non-empty strings'
    );
  });

  it('throws when keys contains empty strings', () => {
    const bad = JSON.stringify({
      secrets: [{ name: 'my/secret', keys: [''] }]
    });
    expect(() => parseConfig(bad, '/tmp/.env-secrets.json')).toThrow(
      'secrets[0].keys must be an array of non-empty strings'
    );
  });
});

describe('loadConfig', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('returns undefined when no config file found', () => {
    expect(loadConfig('/tmp/project')).toBeUndefined();
  });

  it('loads and parses YAML config from CWD', () => {
    mockExistsSync.mockImplementation(
      (p) => p === '/tmp/project/.env-secrets.yml'
    );
    mockReadFileSync.mockReturnValue(YAML_CONFIG);

    const config = loadConfig('/tmp/project');
    expect(config?.provider).toBe('aws');
    expect(config?.secrets).toHaveLength(2);
    expect(config?.secrets[0].name).toBe('my/secret');
    expect(config?.secrets[0].keys).toEqual(['DB_PASSWORD', 'API_KEY']);
  });

  it('loads and parses JSON config from CWD', () => {
    mockExistsSync.mockImplementation(
      (p) => p === '/tmp/project/.env-secrets.json'
    );
    mockReadFileSync.mockReturnValue(JSON_CONFIG);

    const config = loadConfig('/tmp/project');
    expect(config?.provider).toBe('aws');
    expect(config?.region).toBe('us-east-1');
  });
});

describe('serializeConfig', () => {
  it('serializes YAML config without keys when keys are omitted', () => {
    const content = serializeConfig(
      {
        provider: 'aws',
        profile: 'default',
        region: 'us-east-1',
        secrets: [{ name: 'my/secret' }]
      },
      '.env-secrets.yml'
    );

    expect(content).toContain('provider: aws');
    expect(content).toContain('profile: default');
    expect(content).toContain('region: us-east-1');
    expect(content).toContain('name: my/secret');
    expect(content).not.toContain('keys:');
  });

  it('serializes JSON config without keys when keys are omitted', () => {
    const content = serializeConfig(
      {
        provider: 'aws',
        region: 'us-east-1',
        secrets: [{ name: 'my/secret' }]
      },
      '.env-secrets.json'
    );

    expect(JSON.parse(content)).toEqual({
      provider: 'aws',
      region: 'us-east-1',
      secrets: [{ name: 'my/secret' }]
    });
  });
});

describe('writeConfigFile', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('writes config file with owner-only permissions', () => {
    writeConfigFile('.env-secrets.yml', {
      provider: 'aws',
      region: 'us-east-1',
      secrets: [{ name: 'my/secret' }]
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      '.env-secrets.yml',
      expect.stringContaining('name: my/secret'),
      { mode: 0o600 }
    );
  });

  it('does not overwrite an existing config file', () => {
    mockExistsSync.mockReturnValue(true);

    expect(() =>
      writeConfigFile('.env-secrets.yml', {
        provider: 'aws',
        secrets: [{ name: 'my/secret' }]
      })
    ).toThrow('already exists');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });
});

describe('filterSecretKeys', () => {
  const secrets = {
    DB_PASSWORD: 'secret123',
    API_KEY: 'key456',
    INTERNAL: 'internal789'
  };

  it('returns all keys when keys is undefined', () => {
    expect(filterSecretKeys(secrets, undefined)).toEqual(secrets);
  });

  it('returns all keys when keys is empty array', () => {
    expect(filterSecretKeys(secrets, [])).toEqual(secrets);
  });

  it('filters to only specified keys', () => {
    expect(filterSecretKeys(secrets, ['DB_PASSWORD', 'API_KEY'])).toEqual({
      DB_PASSWORD: 'secret123',
      API_KEY: 'key456'
    });
  });

  it('ignores keys that do not exist in secrets', () => {
    expect(filterSecretKeys(secrets, ['DB_PASSWORD', 'NONEXISTENT'])).toEqual({
      DB_PASSWORD: 'secret123'
    });
  });

  it('returns empty object when no keys match', () => {
    expect(filterSecretKeys(secrets, ['NONEXISTENT'])).toEqual({});
  });

  it('returns single key', () => {
    expect(filterSecretKeys(secrets, ['API_KEY'])).toEqual({
      API_KEY: 'key456'
    });
  });
});
