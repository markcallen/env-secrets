const mockListSecrets = jest.fn();
const mockGetSecretMetadata = jest.fn();

jest.mock('../../src/vaults/secretsmanager-admin', () => ({
  listSecrets: mockListSecrets,
  getSecretMetadata: mockGetSecretMetadata
}));

import { TOOL_DEFINITIONS, handleCallTool } from '../../src/mcp/handlers';

const getText = (result: Awaited<ReturnType<typeof handleCallTool>>): string =>
  (result.content[0] as { type: string; text: string }).text;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TOOL_DEFINITIONS', () => {
  it('exports only the three safe tools', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain('list_secrets');
    expect(names).toContain('describe_secret');
    expect(names).toContain('get_command');
    expect(names).not.toContain('get_secret');
    expect(names).not.toContain('set_secret');
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

describe('handleCallTool – removed tools', () => {
  it('returns an error for get_secret', async () => {
    const result = await handleCallTool('get_secret', {
      secret_name: 'my-app/prod'
    });
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Unknown tool');
  });

  it('returns an error for set_secret', async () => {
    const result = await handleCallTool('set_secret', {
      secret_name: 'my-app/prod',
      key: 'KEY'
    });
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Unknown tool');
  });
});

describe('handleCallTool – unknown tool', () => {
  it('returns an error for unrecognised tool name', async () => {
    const result = await handleCallTool('nonexistent_tool', {});
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('Unknown tool');
  });
});
