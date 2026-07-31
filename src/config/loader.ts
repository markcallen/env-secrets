import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';

import type { EnvSecretsConfig, SecretConfig } from './types';

const CONFIG_FILENAMES = [
  '.env-secrets.yml',
  '.env-secrets.yaml',
  '.env-secrets.json'
];

export const findConfigFile = (
  cwd: string = process.cwd()
): string | undefined => {
  for (const filename of CONFIG_FILENAMES) {
    const path = join(cwd, filename);
    if (existsSync(path)) return path;
  }

  const home = homedir();
  for (const filename of CONFIG_FILENAMES) {
    const path = join(home, filename);
    if (existsSync(path)) return path;
  }

  return undefined;
};

const validateConfig = (raw: unknown, filePath: string): EnvSecretsConfig => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Config file "${filePath}" must be a YAML/JSON object.`);
  }

  const config = raw as Record<string, unknown>;

  if (config.provider !== undefined && typeof config.provider !== 'string') {
    throw new Error(`Config "${filePath}": "provider" must be a string.`);
  }

  if (config.profile !== undefined && typeof config.profile !== 'string') {
    throw new Error(`Config "${filePath}": "profile" must be a string.`);
  }

  if (config.region !== undefined && typeof config.region !== 'string') {
    throw new Error(`Config "${filePath}": "region" must be a string.`);
  }

  if (!Array.isArray(config.secrets) || config.secrets.length === 0) {
    throw new Error(
      `Config "${filePath}": "secrets" must be a non-empty array.`
    );
  }

  const secrets: SecretConfig[] = config.secrets.map(
    (entry: unknown, index: number) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(
          `Config "${filePath}": secrets[${index}] must be an object.`
        );
      }

      const s = entry as Record<string, unknown>;

      if (typeof s.name !== 'string' || !s.name) {
        throw new Error(
          `Config "${filePath}": secrets[${index}].name must be a non-empty string.`
        );
      }

      if (s.keys !== undefined) {
        if (
          !Array.isArray(s.keys) ||
          s.keys.some((k) => typeof k !== 'string' || !k)
        ) {
          throw new Error(
            `Config "${filePath}": secrets[${index}].keys must be an array of non-empty strings.`
          );
        }
      }

      return {
        name: s.name,
        keys: s.keys as string[] | undefined
      };
    }
  );

  return {
    provider: config.provider as string | undefined,
    profile: config.profile as string | undefined,
    region: config.region as string | undefined,
    secrets
  };
};

export const parseConfig = (
  content: string,
  filePath: string
): EnvSecretsConfig => {
  let raw: unknown;

  if (filePath.endsWith('.json')) {
    try {
      raw = JSON.parse(content) as unknown;
    } catch {
      throw new Error(`Config file "${filePath}" is not valid JSON.`);
    }
  } else {
    try {
      raw = parseYaml(content);
    } catch {
      throw new Error(`Config file "${filePath}" is not valid YAML.`);
    }
  }

  return validateConfig(raw, filePath);
};

export const loadConfig = (cwd?: string): EnvSecretsConfig | undefined => {
  const configPath = findConfigFile(cwd);
  if (!configPath) return undefined;

  const content = readFileSync(configPath, 'utf8');
  return parseConfig(content, configPath);
};

export const serializeConfig = (
  config: EnvSecretsConfig,
  filePath: string
): string => {
  const data = {
    ...(config.provider ? { provider: config.provider } : {}),
    ...(config.profile ? { profile: config.profile } : {}),
    ...(config.region ? { region: config.region } : {}),
    secrets: config.secrets.map((secret) => ({
      name: secret.name,
      ...(secret.keys?.length ? { keys: secret.keys } : {})
    }))
  };

  if (filePath.endsWith('.json')) {
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  return dumpYaml(data, { lineWidth: -1 });
};

export const writeConfigFile = (filePath: string, config: EnvSecretsConfig) => {
  try {
    writeFileSync(filePath, serializeConfig(config, filePath), {
      flag: 'wx',
      mode: 0o600
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(
        `Config file "${filePath}" already exists and will not be overwritten.`
      );
    }

    throw err;
  }
};

export const filterSecretKeys = (
  secrets: Record<string, unknown>,
  keys?: string[]
): Record<string, unknown> => {
  if (!keys || keys.length === 0) return secrets;

  return Object.fromEntries(
    Object.entries(secrets).filter(([key]) => keys.includes(key))
  );
};
