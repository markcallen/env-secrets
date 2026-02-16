import { PassThrough } from 'node:stream';

import {
  asOutputFormat,
  parseRecoveryDays,
  printData,
  readStdin,
  renderTable,
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
      'Use either --value or --value-stdin, not both.'
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
});
