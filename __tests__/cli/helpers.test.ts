import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import {
  asOutputFormat,
  parseEnvSecrets,
  parseRecoveryDays,
  printData,
  readStdin,
  renderTable,
  resolveAwsScope,
  resolveOutputFormat,
  resolveSecretValue
} from '../../src/cli/helpers';

describe('cli/helpers', () => {
  it('validates output format', () => {
    expect(asOutputFormat('json')).toBe('json');
    expect(asOutputFormat('table')).toBe('table');
    expect(() => asOutputFormat('xml')).toThrow('Invalid output format');
  });

  it('renders empty table message', () => {
    const output = renderTable([{ key: 'name', label: 'Name' }], []);
    expect(output).toBe('No results.');
  });

  it('renders aligned table output', () => {
    const output = renderTable(
      [
        { key: 'name', label: 'Name' },
        { key: 'value', label: 'Value' }
      ],
      [{ name: 'one', value: '1' }]
    );

    expect(output).toContain('Name');
    expect(output).toContain('Value');
    expect(output).toContain('one');
  });

  it('prints JSON output', () => {
    const consoleSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);

    printData('json', [{ key: 'name', label: 'Name' }], [{ name: 'value' }]);

    expect(consoleSpy).toHaveBeenCalledWith(
      JSON.stringify([{ name: 'value' }], null, 2)
    );
    consoleSpy.mockRestore();
  });

  it('parses valid recovery days and rejects invalid values', () => {
    expect(parseRecoveryDays('7')).toBe(7);
    expect(parseRecoveryDays('30')).toBe(30);
    expect(() => parseRecoveryDays('6')).toThrow();
    expect(() => parseRecoveryDays('31')).toThrow();
    expect(() => parseRecoveryDays('abc')).toThrow();
  });

  it('reads stdin content and strips one trailing newline', async () => {
    const stream = new PassThrough();
    const promise = readStdin(stream as unknown as NodeJS.ReadStream);

    stream.write('secret-value\n');
    stream.end();

    await expect(promise).resolves.toBe('secret-value');
  });

  it('resolves secret value from explicit --value', async () => {
    await expect(resolveSecretValue('inline', false)).resolves.toBe('inline');
  });

  it('rejects when both --value and --value-stdin are used', async () => {
    await expect(resolveSecretValue('inline', true)).rejects.toThrow(
      'Use only one secret value source: --value, --value-stdin, or --file.'
    );
  });

  it('rejects when --file and --value-stdin are used together', async () => {
    await expect(
      resolveSecretValue(undefined, true, './secret.txt')
    ).rejects.toThrow(
      'Use only one secret value source: --value, --value-stdin, or --file.'
    );
  });

  it('rejects when --value and --file are used together', async () => {
    await expect(
      resolveSecretValue('inline', false, './secret.txt')
    ).rejects.toThrow(
      'Use only one secret value source: --value, --value-stdin, or --file.'
    );
  });

  it('treats explicit empty --value as provided for mutual exclusion', async () => {
    await expect(resolveSecretValue('', false, './secret.txt')).rejects.toThrow(
      'Use only one secret value source: --value, --value-stdin, or --file.'
    );
  });

  it('rejects stdin mode when no stdin is provided', async () => {
    const originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', {
      value: { ...originalStdin, isTTY: true },
      configurable: true
    });

    await expect(resolveSecretValue(undefined, true)).rejects.toThrow(
      'No stdin detected. Pipe a value when using --value-stdin.'
    );

    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      configurable: true
    });
  });

  it('reads secret value from file and strips one trailing newline', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'env-secrets-test-'));
    const file = join(dir, 'secret.txt');
    writeFileSync(file, 'file-secret\n');

    await expect(resolveSecretValue(undefined, false, file)).resolves.toBe(
      'file-secret'
    );

    rmSync(dir, { recursive: true, force: true });
  });

  it('parses env secrets from KEY=value and export KEY=value formats', () => {
    const parsed = parseEnvSecrets(
      [
        '# comment',
        'export API_KEY=secret1',
        'DATABASE_URL=postgres://db',
        ''
      ].join('\n')
    );

    expect(parsed.entries).toEqual([
      { key: 'API_KEY', value: 'secret1', line: 2 },
      { key: 'DATABASE_URL', value: 'postgres://db', line: 3 }
    ]);
    expect(parsed.skipped).toEqual([]);
  });

  it('handles whitespace around equals in env file', () => {
    const parsed = parseEnvSecrets('  export   NAME =  secret1  ');

    expect(parsed.entries).toEqual([
      { key: 'NAME', value: 'secret1', line: 1 }
    ]);
  });

  it('skips duplicate keys when parsing env file', () => {
    const parsed = parseEnvSecrets(['A=1', 'A=2'].join('\n'));

    expect(parsed.entries).toEqual([{ key: 'A', value: '1', line: 1 }]);
    expect(parsed.skipped).toEqual([
      { key: 'A', line: 2, reason: 'duplicate key' }
    ]);
  });

  it('throws clear error for malformed env lines', () => {
    expect(() => parseEnvSecrets('NOT_A_VALID_LINE')).toThrow(
      'Malformed env line 1'
    );
    expect(() => parseEnvSecrets('BAD=secret')).not.toThrow();
  });

  it('does not include raw line content in malformed env errors', () => {
    expect(() => parseEnvSecrets('export SECRET_ONLY')).toThrow(
      'Expected KEY=value or export KEY=value.'
    );
    expect(() => parseEnvSecrets('export SECRET_ONLY')).not.toThrow(
      /SECRET_ONLY/
    );
  });

  it('prefers explicit aws scope options over global options', () => {
    const command = {
      optsWithGlobals: () => ({
        profile: 'global-profile',
        region: 'us-west-2'
      })
    };

    expect(
      resolveAwsScope(
        { profile: 'local-profile', region: 'us-east-1' },
        command
      )
    ).toEqual({
      profile: 'local-profile',
      region: 'us-east-1'
    });
  });

  it('falls back to global aws scope options when local options are absent', () => {
    const command = {
      optsWithGlobals: () => ({
        profile: 'global-profile',
        region: 'us-west-2'
      })
    };

    expect(resolveAwsScope({}, command)).toEqual({
      profile: 'global-profile',
      region: 'us-west-2'
    });
  });

  describe('resolveOutputFormat', () => {
    it('uses explicit local output option', () => {
      expect(resolveOutputFormat({ output: 'json' })).toBe('json');
      expect(resolveOutputFormat({ output: 'table' })).toBe('table');
    });

    it('throws for invalid local output option', () => {
      expect(() => resolveOutputFormat({ output: 'xml' })).toThrow(
        'Invalid output format'
      );
    });

    it('inherits json or table from global options', () => {
      const jsonCmd = { optsWithGlobals: () => ({ output: 'json' }) };
      const tableCmd = { optsWithGlobals: () => ({ output: 'table' }) };
      expect(resolveOutputFormat({}, jsonCmd)).toBe('json');
      expect(resolveOutputFormat({}, tableCmd)).toBe('table');
    });

    it('ignores a file path in global output and defaults to table', () => {
      const command = { optsWithGlobals: () => ({ output: 'secrets.env' }) };
      expect(resolveOutputFormat({}, command)).toBe('table');
    });

    it('defaults to table when no options are provided', () => {
      expect(resolveOutputFormat({})).toBe('table');
    });

    it('prefers local option over global option', () => {
      const command = { optsWithGlobals: () => ({ output: 'json' }) };
      expect(resolveOutputFormat({ output: 'table' }, command)).toBe('table');
    });
  });
});
