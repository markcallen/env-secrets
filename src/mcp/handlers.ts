import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { secretsmanager } from '../vaults/secretsmanager';
import {
  listSecrets,
  getSecretMetadata,
  createSecret,
  updateSecret,
  getSecretString
} from '../vaults/secretsmanager-admin';
import { promptTty } from './tty';

const shellQuote = (s: string): string => `'${s.replace(/'/g, "'\\''")}'`;

export const TOOL_DEFINITIONS = [
  {
    name: 'get_secret',
    description: 'Retrieve key/value pairs from an AWS Secrets Manager secret',
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
    name: 'set_secret',
    description:
      'Set a key in a secret. Prompts for the value via TTY so it never enters the MCP stream.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        secret_name: { type: 'string', description: 'Secret name' },
        key: {
          type: 'string',
          description: 'Key to set within the JSON secret'
        },
        description: {
          type: 'string',
          description: 'Optional secret description'
        },
        region: { type: 'string', description: 'AWS region' },
        profile: { type: 'string', description: 'AWS profile name' }
      },
      required: ['secret_name', 'key']
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
    if (name === 'get_secret') {
      const { secret_name, region, profile } = args as {
        secret_name: string;
        region?: string;
        profile?: string;
      };
      const result = await secretsmanager({
        secret: secret_name,
        region,
        profile
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

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
        secret_name: string;
        region?: string;
        profile?: string;
      };
      const result = await getSecretMetadata({
        name: secret_name,
        region,
        profile
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

    if (name === 'set_secret') {
      const { secret_name, key, description, region, profile } = args as {
        secret_name: string;
        key: string;
        description?: string;
        region?: string;
        profile?: string;
      };

      const value = await promptTty(`Enter value for ${key}: `);

      let existing: Record<string, unknown> = {};
      let secretFound = false;
      try {
        const raw = await getSecretString({
          name: secret_name,
          region,
          profile
        });
        secretFound = true;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error(
            `Secret "${secret_name}" is not a JSON object. Use the CLI to manage non-JSON secrets directly.`
          );
        }
        existing = parsed as Record<string, unknown>;
      } catch (err) {
        if (secretFound) {
          throw err;
        }
        // secret does not exist yet — will be created below
      }

      const merged = { ...existing, [key]: value };
      const mergedString = JSON.stringify(merged);

      let result: { arn?: string; name?: string; versionId?: string };
      try {
        result = await updateSecret({
          name: secret_name,
          value: mergedString,
          description,
          region,
          profile
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('was not found')) {
          result = await createSecret({
            name: secret_name,
            value: mergedString,
            description,
            region,
            profile
          });
        } else {
          throw err;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: true, name: result.name, arn: result.arn, key },
              null,
              2
            )
          }
        ]
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
      } else {
        cmd = `env-secrets aws${flagStr}`;
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
