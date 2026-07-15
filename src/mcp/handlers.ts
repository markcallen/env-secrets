import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { listSecrets, getSecretMetadata } from '../vaults/secretsmanager-admin';

const shellQuote = (s: string): string => `'${s.replace(/'/g, "'\\''")}'`;

export const TOOL_DEFINITIONS = [
  {
    name: 'list_secrets',
    description: 'List secrets in AWS Secrets Manager',
    inputSchema: {
      type: 'object' as const,
      properties: {
        prefix: {
          type: 'string',
          description: 'Filter secrets by name prefix'
        },
        region: { type: 'string', description: 'AWS region' },
        profile: { type: 'string', description: 'AWS profile name' }
      }
    }
  },
  {
    name: 'describe_secret',
    description: 'Get metadata about a secret (never returns values)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        secret_name: { type: 'string', description: 'Secret name' },
        region: { type: 'string', description: 'AWS region' },
        profile: { type: 'string', description: 'AWS profile name' }
      },
      required: ['secret_name']
    }
  },
  {
    name: 'get_command',
    description:
      'Returns a ready-to-run env-secrets CLI command string. For set action always uses --value-stdin.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'list', 'describe'],
          description: 'CLI action'
        },
        secret_name: {
          type: 'string',
          description:
            'Secret name (required for get, set, describe; optional prefix for list)'
        },
        key: {
          type: 'string',
          description: 'Key name (used for set action)'
        },
        region: { type: 'string', description: 'AWS region flag value' },
        profile: { type: 'string', description: 'AWS profile flag value' }
      },
      required: ['action']
    }
  }
];

export async function handleCallTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    if (name === 'list_secrets') {
      const { prefix, region, profile } = args as {
        prefix?: string;
        region?: string;
        profile?: string;
      };
      const result = await listSecrets({ prefix, region, profile });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

    if (name === 'describe_secret') {
      const { secret_name, region, profile } = args as {
        secret_name?: string;
        region?: string;
        profile?: string;
      };
      if (!secret_name || typeof secret_name !== 'string') {
        return {
          content: [{ type: 'text', text: 'Error: secret_name is required' }],
          isError: true
        };
      }
      const result = await getSecretMetadata({
        name: secret_name,
        region,
        profile
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

    if (name === 'get_command') {
      const { action, secret_name, key, region, profile } = args as {
        action: string;
        secret_name?: string;
        key?: string;
        region?: string;
        profile?: string;
      };

      const flags: string[] = [];
      if (region) flags.push(`--region ${shellQuote(region)}`);
      if (profile) flags.push(`--profile ${shellQuote(profile)}`);
      const flagStr = flags.length ? ` ${flags.join(' ')}` : '';

      let cmd: string;

      if (action === 'get' && secret_name) {
        cmd = `env-secrets aws -s ${shellQuote(
          secret_name
        )}${flagStr} -- <your-program>`;
      } else if (action === 'set' && secret_name && key) {
        cmd = `printf 'your-value' | env-secrets aws secret append -n ${shellQuote(
          secret_name
        )} --key ${shellQuote(key)} --value-stdin${flagStr}`;
      } else if (action === 'list') {
        const prefixFlag = secret_name
          ? ` --prefix ${shellQuote(secret_name)}`
          : '';
        cmd = `env-secrets aws secret list${prefixFlag}${flagStr}`;
      } else if (action === 'describe' && secret_name) {
        cmd = `env-secrets aws secret get -n ${shellQuote(
          secret_name
        )}${flagStr}`;
      } else if (action === 'get' && !secret_name) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: secret_name is required for action "get"'
            }
          ],
          isError: true
        };
      } else if (action === 'set' && (!secret_name || !key)) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: secret_name and key are required for action "set"'
            }
          ],
          isError: true
        };
      } else if (action === 'describe' && !secret_name) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: secret_name is required for action "describe"'
            }
          ],
          isError: true
        };
      } else {
        return {
          content: [
            { type: 'text', text: `Error: unknown action "${action}"` }
          ],
          isError: true
        };
      }

      return {
        content: [{ type: 'text', text: cmd }]
      };
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true
    };
  }
}
