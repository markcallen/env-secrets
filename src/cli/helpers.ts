import { readFile } from 'node:fs/promises';

export type OutputFormat = 'json' | 'table';
export interface AwsScopeOptions {
  profile?: string;
  region?: string;
}
export interface EnvSecretEntry {
  key: string;
  value: string;
  line: number;
}
export interface ParsedEnvSecrets {
  entries: EnvSecretEntry[];
  skipped: Array<{ key: string; line: number; reason: string }>;
}

interface CommandLikeWithGlobalOpts {
  optsWithGlobals?: () => Record<string, unknown>;
}

export const asOutputFormat = (value: string): OutputFormat => {
  if (value !== 'json' && value !== 'table') {
    throw new Error(`Invalid output format "${value}". Use "json" or "table".`);
  }

  return value;
};

export const renderTable = (
  headers: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string | undefined>>
) => {
  if (rows.length === 0) {
    return 'No results.';
  }

  const widths = headers.map((header) => {
    return Math.max(
      header.label.length,
      ...rows.map((row) => String(row[header.key] || '').length)
    );
  });

  const headerLine = headers
    .map((header, index) => header.label.padEnd(widths[index]))
    .join('  ');
  const divider = headers
    .map((_, index) => '-'.repeat(widths[index]))
    .join('  ');
  const lines = rows.map((row) =>
    headers
      .map((header, index) =>
        String(row[header.key] || '').padEnd(widths[index])
      )
      .join('  ')
  );

  return [headerLine, divider, ...lines].join('\n');
};

export const printData = (
  format: OutputFormat,
  headers: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string | undefined>>
) => {
  if (format === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  // eslint-disable-next-line no-console
  console.log(renderTable(headers, rows));
};

export const parseRecoveryDays = (value: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 7 || parsed > 30) {
    throw new Error('Recovery days must be an integer between 7 and 30.');
  }

  return parsed;
};

export const readStdin = async (stdin: NodeJS.ReadStream = process.stdin) => {
  const chunks: Buffer[] = [];

  return await new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      resolve(
        Buffer.concat(chunks)
          .toString('utf8')
          .replace(/\r?\n$/, '')
      );
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.off('error', onError);
    };

    stdin.on('data', onData);
    stdin.once('end', onEnd);
    stdin.once('error', onError);
  });
};

export const resolveSecretValue = async (
  value?: string,
  valueStdin?: boolean,
  valueFile?: string
): Promise<string | undefined> => {
  const providedSources = [
    Boolean(value),
    Boolean(valueStdin),
    Boolean(valueFile)
  ].filter(Boolean).length;
  if (providedSources > 1) {
    throw new Error(
      'Use only one secret value source: --value, --value-stdin, or --file.'
    );
  }

  if (valueStdin) {
    if (process.stdin.isTTY) {
      throw new Error(
        'No stdin detected. Pipe a value when using --value-stdin.'
      );
    }
    return await readStdin();
  }

  if (valueFile) {
    const content = await readFile(valueFile, 'utf8');
    return content.replace(/\r?\n$/, '');
  }

  return value;
};

const parseEnvLine = (
  line: string,
  lineNumber: number
): { key: string; value: string } | undefined => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const candidate = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trimStart()
    : trimmed;
  const separatorIndex = candidate.indexOf('=');

  if (separatorIndex <= 0) {
    throw new Error(
      `Malformed env line ${lineNumber}: "${line}". Expected KEY=value or export KEY=value.`
    );
  }

  const key = candidate.slice(0, separatorIndex).trim();
  const value = candidate.slice(separatorIndex + 1).trim();

  if (!key) {
    throw new Error(
      `Malformed env line ${lineNumber}: "${line}". Expected KEY=value or export KEY=value.`
    );
  }

  return { key, value };
};

export const parseEnvSecrets = (content: string): ParsedEnvSecrets => {
  const seenKeys = new Set<string>();
  const entries: EnvSecretEntry[] = [];
  const skipped: Array<{ key: string; line: number; reason: string }> = [];

  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseEnvLine(lines[index], index + 1);
    if (!parsed) {
      continue;
    }

    if (seenKeys.has(parsed.key)) {
      skipped.push({
        key: parsed.key,
        line: index + 1,
        reason: 'duplicate key'
      });
      continue;
    }

    seenKeys.add(parsed.key);
    entries.push({
      key: parsed.key,
      value: parsed.value,
      line: index + 1
    });
  }

  return { entries, skipped };
};

export const parseEnvSecretsFile = async (
  path: string
): Promise<ParsedEnvSecrets> => {
  const content = await readFile(path, 'utf8');
  return parseEnvSecrets(content);
};

export const resolveAwsScope = (
  options: AwsScopeOptions,
  command?: CommandLikeWithGlobalOpts
): AwsScopeOptions => {
  const globalOptions = command?.optsWithGlobals?.() || {};

  const profile =
    options.profile ||
    (typeof globalOptions.profile === 'string'
      ? globalOptions.profile
      : undefined);
  const region =
    options.region ||
    (typeof globalOptions.region === 'string'
      ? globalOptions.region
      : undefined);

  return { profile, region };
};
