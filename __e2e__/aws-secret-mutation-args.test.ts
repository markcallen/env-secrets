import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  cliWithEnv,
  cleanupTempFile,
  execAwslocalCommand
} from './utils/test-utils';
import { registerAwsE2eContext } from './utils/aws-e2e-context';

describe('AWS Secret Mutation CLI Args', () => {
  const { getLocalStackEnv } = registerAwsE2eContext();

  test('should append and remove keys on a JSON secret', async () => {
    const secretName = `managed-secret-append-remove-${Date.now()}`;
    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-append-remove-${Date.now()}.env`
    );
    fs.writeFileSync(tempFile, 'API_KEY=first');

    const createResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'upsert',
        '--file',
        tempFile,
        '--name',
        secretName,
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const appendResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'append',
        '-n',
        secretName,
        '--key',
        'JIRA_EMAIL_TOKEN',
        '-v',
        'blah',
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(appendResult.code).toBe(0);

    const afterAppend = await execAwslocalCommand(
      `awslocal secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query SecretString --output text`,
      getLocalStackEnv()
    );
    expect(JSON.parse(afterAppend.stdout.trim())).toEqual({
      API_KEY: 'first',
      JIRA_EMAIL_TOKEN: 'blah'
    });

    const removeResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'remove',
        '-n',
        secretName,
        '--key',
        'API_KEY',
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(removeResult.code).toBe(0);

    const afterRemove = await execAwslocalCommand(
      `awslocal secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query SecretString --output text`,
      getLocalStackEnv()
    );
    expect(JSON.parse(afterRemove.stdout.trim())).toEqual({
      JIRA_EMAIL_TOKEN: 'blah'
    });

    const deleteResult = await cliWithEnv(
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
    expect(deleteResult.code).toBe(0);
    cleanupTempFile(tempFile);
  });

  test('should error when appending to a non-existent secret', async () => {
    const result = await cliWithEnv(
      [
        'aws',
        'secret',
        'append',
        '-n',
        `no-such-secret-${Date.now()}`,
        '--key',
        'NEW_KEY',
        '-v',
        'value'
      ],
      getLocalStackEnv()
    );
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(
      /ResourceNotFoundException|not found|does not exist/i
    );
  });

  test('should error when removing a key that does not exist in the secret', async () => {
    const secretName = `e2e-remove-missing-key-${Date.now()}`;
    const createResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'create',
        '-n',
        secretName,
        '-v',
        JSON.stringify({ API_KEY: 'abc' })
      ],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const removeResult = await cliWithEnv(
      ['aws', 'secret', 'remove', '-n', secretName, '--key', 'GHOST_KEY'],
      getLocalStackEnv()
    );
    expect(removeResult.code).not.toBe(0);
    expect(removeResult.stderr).toContain('None of the requested keys exist');

    await cliWithEnv(
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
  });

  test('should error when removing the last key in a secret', async () => {
    const secretName = `e2e-remove-last-key-${Date.now()}`;
    const createResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'create',
        '-n',
        secretName,
        '-v',
        JSON.stringify({ ONLY_KEY: 'only-value' })
      ],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const removeResult = await cliWithEnv(
      ['aws', 'secret', 'remove', '-n', secretName, '--key', 'ONLY_KEY'],
      getLocalStackEnv()
    );
    expect(removeResult.code).not.toBe(0);
    expect(removeResult.stderr).toContain('Cannot remove all keys');

    await cliWithEnv(
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
  });

  test('should overwrite an existing key with append and preserve other keys', async () => {
    const secretName = `e2e-append-overwrite-${Date.now()}`;
    const createResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'create',
        '-n',
        secretName,
        '-v',
        JSON.stringify({ API_KEY: 'old-value', DB_URL: 'postgres://...' })
      ],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const appendResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'append',
        '-n',
        secretName,
        '--key',
        'API_KEY',
        '-v',
        'new-value',
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(appendResult.code).toBe(0);

    const afterAppend = await execAwslocalCommand(
      `awslocal secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query SecretString --output text`,
      getLocalStackEnv()
    );
    expect(JSON.parse(afterAppend.stdout.trim())).toEqual({
      API_KEY: 'new-value',
      DB_URL: 'postgres://...'
    });

    await cliWithEnv(
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
  });

  test('should partially remove keys and report missing ones', async () => {
    const secretName = `e2e-remove-partial-${Date.now()}`;
    const createResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'create',
        '-n',
        secretName,
        '-v',
        JSON.stringify({ REAL_KEY: 'value', KEEP_KEY: 'keep' })
      ],
      getLocalStackEnv()
    );
    expect(createResult.code).toBe(0);

    const removeResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'remove',
        '-n',
        secretName,
        '--key',
        'REAL_KEY',
        '--key',
        'GHOST_KEY',
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(removeResult.code).toBe(0);
    const output = JSON.parse(removeResult.stdout) as Array<{
      removed: string;
      missing: string;
    }>;
    expect(output[0].removed).toContain('REAL_KEY');
    expect(output[0].missing).toContain('GHOST_KEY');

    await cliWithEnv(
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
  });

  test('should upsert secrets from env file', async () => {
    const secretName = `e2e-upsert-${Date.now()}`;
    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-upsert-${Date.now()}.env`
    );

    fs.writeFileSync(
      tempFile,
      ['# sample', 'export API_KEY=first', 'DB_URL = postgres://one'].join('\n')
    );

    const firstRun = await cliWithEnv(
      [
        'aws',
        'secret',
        'upsert',
        '--file',
        tempFile,
        '--name',
        secretName,
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(firstRun.code).toBe(0);
    const firstJson = JSON.parse(firstRun.stdout) as {
      summary: { created: number; updated: number; skipped: number };
    };
    expect(firstJson.summary.created).toBe(1);
    expect(firstJson.summary.updated).toBe(0);

    const firstSecret = await execAwslocalCommand(
      `awslocal secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query SecretString --output text`,
      getLocalStackEnv()
    );
    expect(JSON.parse(firstSecret.stdout.trim())).toEqual({
      API_KEY: 'first',
      DB_URL: 'postgres://one'
    });

    fs.writeFileSync(
      tempFile,
      ['export API_KEY=second', 'DB_URL=postgres://two'].join('\n')
    );

    const secondRun = await cliWithEnv(
      [
        'aws',
        'secret',
        'import',
        '--file',
        tempFile,
        '--name',
        secretName,
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(secondRun.code).toBe(0);
    const secondJson = JSON.parse(secondRun.stdout) as {
      summary: { created: number; updated: number; skipped: number };
    };
    expect(secondJson.summary.created).toBe(0);
    expect(secondJson.summary.updated).toBe(1);
    expect(secondJson.summary.skipped).toBe(0);

    const secondSecret = await execAwslocalCommand(
      `awslocal secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query SecretString --output text`,
      getLocalStackEnv()
    );
    expect(JSON.parse(secondSecret.stdout.trim())).toEqual({
      API_KEY: 'second',
      DB_URL: 'postgres://two'
    });

    const deleteResult = await cliWithEnv(
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
    expect(deleteResult.code).toBe(0);
    cleanupTempFile(tempFile);
  });
});
