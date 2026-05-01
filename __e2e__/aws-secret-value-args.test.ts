import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { cliWithEnv, cleanupTempFile } from './utils/test-utils';
import { registerAwsE2eContext } from './utils/aws-e2e-context';

describe('AWS Secret Value CLI Args', () => {
  const { getLocalStackEnv } = registerAwsE2eContext();

  test('should show masked values by default (table output)', async () => {
    const secretName = `e2e-value-masked-${Date.now()}`;
    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-value-${Date.now()}.env`
    );
    fs.writeFileSync(tempFile, 'DB_PASSWORD=super-secret\nAPI_KEY=abc123');

    const createResult = await cliWithEnv(
      ['aws', 'secret', 'upsert', '--file', tempFile, '--name', secretName],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const valueResult = await cliWithEnv(
      ['aws', 'secret', 'value', '-n', secretName],
      getLocalStackEnv()
    );
    expect(valueResult.code).toBe(0);
    expect(valueResult.stdout).toContain('DB_PASSWORD');
    expect(valueResult.stdout).toContain('API_KEY');
    expect(valueResult.stdout).toContain('****');
    expect(valueResult.stdout).not.toContain('super-secret');
    expect(valueResult.stdout).not.toContain('abc123');

    const deleteResult1 = await cliWithEnv(
      [
        'aws',
        'secret',
        'delete',
        '-n',
        secretName,
        '--force-delete-without-recovery',
        '--yes'
      ],
      getLocalStackEnv()
    );
    expect(deleteResult1.code).toBe(0);
    cleanupTempFile(tempFile);
  });

  test('should reveal values with --reveal flag and warn on stderr', async () => {
    const secretName = `e2e-value-reveal-${Date.now()}`;
    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-reveal-${Date.now()}.env`
    );
    fs.writeFileSync(tempFile, 'DB_PASSWORD=super-secret\nAPI_KEY=abc123');

    const createResult = await cliWithEnv(
      ['aws', 'secret', 'upsert', '--file', tempFile, '--name', secretName],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const valueResult = await cliWithEnv(
      ['aws', 'secret', 'value', '-n', secretName, '--reveal'],
      getLocalStackEnv()
    );
    expect(valueResult.code).toBe(0);
    expect(valueResult.stdout).toContain('DB_PASSWORD');
    expect(valueResult.stdout).toContain('super-secret');
    expect(valueResult.stdout).toContain('API_KEY');
    expect(valueResult.stdout).toContain('abc123');
    expect(valueResult.stderr).toContain(
      'Warning: displaying sensitive secret values.'
    );

    const deleteResult2 = await cliWithEnv(
      [
        'aws',
        'secret',
        'delete',
        '-n',
        secretName,
        '--force-delete-without-recovery',
        '--yes'
      ],
      getLocalStackEnv()
    );
    expect(deleteResult2.code).toBe(0);
    cleanupTempFile(tempFile);
  });

  test('should output full values as JSON without --reveal', async () => {
    const secretName = `e2e-value-json-${Date.now()}`;
    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-json-${Date.now()}.env`
    );
    fs.writeFileSync(tempFile, 'DB_PASSWORD=super-secret\nAPI_KEY=abc123');

    const createResult = await cliWithEnv(
      ['aws', 'secret', 'upsert', '--file', tempFile, '--name', secretName],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const valueResult = await cliWithEnv(
      ['aws', 'secret', 'value', '-n', secretName, '--output', 'json'],
      getLocalStackEnv()
    );
    expect(valueResult.code).toBe(0);
    const parsed = JSON.parse(valueResult.stdout) as Record<string, string>;
    expect(parsed.DB_PASSWORD).toBe('super-secret');
    expect(parsed.API_KEY).toBe('abc123');

    const deleteResult3 = await cliWithEnv(
      [
        'aws',
        'secret',
        'delete',
        '-n',
        secretName,
        '--force-delete-without-recovery',
        '--yes'
      ],
      getLocalStackEnv()
    );
    expect(deleteResult3.code).toBe(0);
    cleanupTempFile(tempFile);
  });

  test('should fail for a non-existent secret', async () => {
    const valueResult = await cliWithEnv(
      ['aws', 'secret', 'value', '-n', 'does-not-exist-e2e'],
      getLocalStackEnv()
    );
    expect(valueResult.code).not.toBe(0);
    expect(valueResult.stderr).toContain('not found');
  });
});
