const mockSecretSmanager = jest.fn();
const mockListSecrets = jest.fn();
const mockGetSecretMetadata = jest.fn();
const mockCreateSecret = jest.fn();
const mockUpdateSecret = jest.fn();
const mockGetSecretString = jest.fn();
const mockPromptTty = jest.fn();

jest.mock('../../src/vaults/secretsmanager', () => ({
  secretsmanager: mockSecretSmanager
}));

jest.mock('../../src/vaults/secretsmanager-admin', () => ({
  listSecrets: mockListSecrets,
  getSecretMetadata: mockGetSecretMetadata,
  createSecret: mockCreateSecret,
  updateSecret: mockUpdateSecret,
  getSecretString: mockGetSecretString
}));

jest.mock('../../src/mcp/tty', () => ({
  promptTty: mockPromptTty
}));

import { TOOL_DEFINITIONS, handleCallTool } from '../../src/mcp/handlers';

const getText = (result: Awaited<ReturnType<typeof handleCallTool>>): string =>
  (result.content[0] as { type: string; text: string }).text;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TOOL_DEFINITIONS', () => {
  it('exports all five tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain('get_secret');
    expect(names).toContain('list_secrets');
    expect(names).toContain('describe_secret');
    expect(names).toContain('set_secret');
    expect(names).toContain('get_command');
  });

  it('set_secret schema has no value parameter', () => {
    const setSecret = TOOL_DEFINITIONS.find((t) => t.name === 'set_secret');
    expect(setSecret).toBeDefined();
    expect(setSecret?.inputSchema.properties).not.toHaveProperty('value');
  });

  it('set_secret requires secret_name and key', () => {
    const setSecret = TOOL_DEFINITIONS.find((t) => t.name === 'set_secret');
    expect(setSecret?.inputSchema.required).toEqual(
      expect.arrayContaining(['secret_name', 'key'])
    );
  });
});

describe('handleCallTool – get_secret', () => {
  it('returns secret key/value pairs', async () => {
    mockSecretSmanager.mockResolvedValue({
      DB_URL: 'postgres://...',
      API_KEY: 'sk-123'
    });
    const result = await handleCallTool('get_secret', {
      secret_name: 'my-app/prod',
      region: 'us-east-1'
    });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(getText(result));
    expect(parsed).toEqual({ DB_URL: 'postgres://...', API_KEY: 'sk-123' });
  });

  it('passes region and profile to secretsmanager', async () => {
    mockSecretSmanager.mockResolvedValue({});
    await handleCallTool('get_secret', {
      secret_name: 'my-app',
      region: 'eu-west-1',
      profile: 'dev'
    });
    expect(mockSecretSmanager).toHaveBeenCalledWith({
      secret: 'my-app',
      region: 'eu-west-1',
      profile: 'dev'
    });
  });

  it('returns error content on failure', async () => {
    mockSecretSmanager.mockRejectedValue(new Error('Access denied'));
    const result = await handleCallTool('get_secret', { secret_name: 'bad' });
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Access denied');
  });
});

describe('handleCallTool – list_secrets', () => {
  it('returns list of secrets', async () => {
    mockListSecrets.mockResolvedValue([
      {
        name: 'my-app/prod',
        description: 'Prod secrets',
        lastChangedDate: '2024-01-01'
      }
    ]);
    const result = await handleCallTool('list_secrets', {});
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(getText(result));
    expect(parsed[0].name).toBe('my-app/prod');
  });

  it('passes prefix filter and region', async () => {
    mockListSecrets.mockResolvedValue([]);
    await handleCallTool('list_secrets', {
      prefix: 'my-app/',
      region: 'us-west-2'
    });
    expect(mockListSecrets).toHaveBeenCalledWith({
      prefix: 'my-app/',
      region: 'us-west-2',
      profile: undefined
    });
  });
});

describe('handleCallTool – describe_secret', () => {
  it('returns metadata without exposing values', async () => {
    mockGetSecretMetadata.mockResolvedValue({
      name: 'my-app/prod',
      arn: 'arn:aws:secretsmanager:us-east-1:123:secret:my-app/prod',
      createdDate: '2024-01-01'
    });
    const result = await handleCallTool('describe_secret', {
      secret_name: 'my-app/prod'
    });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(getText(result));
    expect(parsed.name).toBe('my-app/prod');
    expect(parsed.arn).toContain('arn:aws');
    expect(parsed).not.toHaveProperty('SecretString');
  });
});

describe('handleCallTool – set_secret', () => {
  it('prompts via TTY and stores merged secret', async () => {
    mockPromptTty.mockResolvedValue('supersecret');
    mockGetSecretString.mockResolvedValue(JSON.stringify({ EXISTING: 'val' }));
    mockUpdateSecret.mockResolvedValue({ name: 'my-app/prod', arn: 'arn:...' });

    const result = await handleCallTool('set_secret', {
      secret_name: 'my-app/prod',
      key: 'NEW_KEY'
    });

    expect(mockPromptTty).toHaveBeenCalledWith(
      expect.stringContaining('NEW_KEY')
    );
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(getText(result));
    expect(parsed.success).toBe(true);
    expect(parsed.key).toBe('NEW_KEY');
    expect(parsed).not.toHaveProperty('value');
  });

  it('merges new key with existing secret keys', async () => {
    mockPromptTty.mockResolvedValue('newvalue');
    mockGetSecretString.mockResolvedValue(JSON.stringify({ EXISTING: 'old' }));
    mockUpdateSecret.mockResolvedValue({ name: 'my-app', arn: 'arn:...' });

    await handleCallTool('set_secret', {
      secret_name: 'my-app',
      key: 'ADDED'
    });

    expect(mockUpdateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        value: JSON.stringify({ EXISTING: 'old', ADDED: 'newvalue' })
      })
    );
  });

  it('creates secret when it does not exist', async () => {
    mockPromptTty.mockResolvedValue('value');
    mockGetSecretString.mockRejectedValue(new Error('not found'));
    mockUpdateSecret.mockRejectedValue(new Error('was not found'));
    mockCreateSecret.mockResolvedValue({ name: 'new-secret', arn: 'arn:...' });

    const result = await handleCallTool('set_secret', {
      secret_name: 'new-secret',
      key: 'KEY'
    });

    expect(mockCreateSecret).toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
  });

  it('response never contains the secret value', async () => {
    mockPromptTty.mockResolvedValue('topsecret-value');
    mockGetSecretString.mockResolvedValue('{}');
    mockUpdateSecret.mockResolvedValue({ name: 'my-app', arn: 'arn:...' });

    const result = await handleCallTool('set_secret', {
      secret_name: 'my-app',
      key: 'TOKEN'
    });

    expect(getText(result)).not.toContain('topsecret-value');
  });

  it('returns error when TTY is unavailable', async () => {
    mockPromptTty.mockRejectedValue(new Error('/dev/tty is unavailable'));

    const result = await handleCallTool('set_secret', {
      secret_name: 'my-app',
      key: 'KEY'
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('/dev/tty is unavailable');
  });

  it('rethrows updateSecret errors that are not "was not found"', async () => {
    mockPromptTty.mockResolvedValue('value');
    mockGetSecretString.mockRejectedValue(new Error('secret does not exist'));
    mockUpdateSecret.mockRejectedValue(new Error('KMS key access denied'));

    const result = await handleCallTool('set_secret', {
      secret_name: 'my-app',
      key: 'KEY'
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('KMS key access denied');
    expect(mockCreateSecret).not.toHaveBeenCalled();
  });

  it('returns error when existing secret is not a JSON object', async () => {
    mockPromptTty.mockResolvedValue('value');
    // Valid JSON but not an object (a JSON string value)
    mockGetSecretString.mockResolvedValue('"just-a-string"');

    const result = await handleCallTool('set_secret', {
      secret_name: 'my-app',
      key: 'KEY'
    });

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('not a JSON object');
  });
});

describe('handleCallTool – get_command', () => {
  it('returns inject command for action=get', async () => {
    const result = await handleCallTool('get_command', {
      action: 'get',
      secret_name: 'my-app/prod',
      region: 'us-east-1'
    });
    expect(getText(result)).toContain('env-secrets aws');
    expect(getText(result)).toContain("-s 'my-app/prod'");
    expect(getText(result)).toContain("--region 'us-east-1'");
  });

  it('uses --value-stdin for action=set', async () => {
    const result = await handleCallTool('get_command', {
      action: 'set',
      secret_name: 'my-app',
      key: 'TOKEN'
    });
    expect(getText(result)).toContain('--value-stdin');
  });

  it('returned set command never contains an actual value literal', async () => {
    const result = await handleCallTool('get_command', {
      action: 'set',
      secret_name: 'my-app',
      key: 'TOKEN'
    });
    const cmd = getText(result);
    expect(cmd).toMatch(/--value-stdin/);
    // No real value appears in the command itself
    expect(cmd).not.toMatch(/TOKEN=.+/);
  });

  it('returns list command for action=list', async () => {
    const result = await handleCallTool('get_command', { action: 'list' });
    expect(getText(result)).toContain('secret list');
  });

  it('includes prefix for action=list with secret_name', async () => {
    const result = await handleCallTool('get_command', {
      action: 'list',
      secret_name: 'my-app/'
    });
    expect(getText(result)).toContain("--prefix 'my-app/'");
  });

  it('returns metadata command for action=describe', async () => {
    const result = await handleCallTool('get_command', {
      action: 'describe',
      secret_name: 'my-app'
    });
    expect(getText(result)).toContain('secret get');
    expect(getText(result)).toContain('my-app');
  });

  it('includes profile flag when provided', async () => {
    const result = await handleCallTool('get_command', {
      action: 'get',
      secret_name: 'x',
      profile: 'prod'
    });
    expect(getText(result)).toContain("--profile 'prod'");
  });

  it('returns bare env-secrets command when action=get has no secret_name', async () => {
    const result = await handleCallTool('get_command', { action: 'get' });
    expect(getText(result)).toBe('env-secrets aws');
  });

  it('quotes secret names with single quotes in shell commands', async () => {
    const result = await handleCallTool('get_command', {
      action: 'get',
      secret_name: "app's secret",
      region: 'us-east-1'
    });
    expect(getText(result)).toContain("'app'\\''s secret'");
  });
});

describe('handleCallTool – unknown tool', () => {
  it('returns an error for unrecognised tool name', async () => {
    const result = await handleCallTool('nonexistent_tool', {});
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Unknown tool');
  });
});
