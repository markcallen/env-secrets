import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  cliWithEnv,
  cliWithEnvAndStdin,
  cleanupTempFile
} from './utils/test-utils';
import { registerAwsE2eContext } from './utils/aws-e2e-context';

describe('AWS Secret Subcommand Lifecycle Args', () => {
  const { createTestSecret, getLocalStackEnv } = registerAwsE2eContext();

  test('should create, list, get, and delete a secret', async () => {
    const secretName = `e2e-managed-secret-${Date.now()}`;

    const createResult = await cliWithEnv(
      ['aws', 'secret', 'create', '-n', secretName, '-v', 'initial-value'],
      getLocalStackEnv()
    );

    expect(createResult.code).toBe(0);
    expect(createResult.stdout).toContain(secretName);

    const listResult = await cliWithEnv(
      ['aws', 'secret', 'list', '--prefix', 'e2e-managed-secret-'],
      getLocalStackEnv()
    );
    expect(listResult.code).toBe(0);
    expect(listResult.stdout).toContain(secretName);

    const getResult = await cliWithEnv(
      ['aws', 'secret', 'get', '-n', secretName],
      getLocalStackEnv()
    );
    expect(getResult.code).toBe(0);
    expect(getResult.stdout).toContain(secretName);
    expect(getResult.stdout).not.toContain('initial-value');

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
  });

  test('should update secret value from stdin', async () => {
    const secret = await createTestSecret({
      name: `managed-secret-stdin-${Date.now()}`,
      value: 'initial-value',
      description: 'Secret for stdin update test'
    });

    const updateResult = await cliWithEnvAndStdin(
      ['aws', 'secret', 'update', '-n', secret.prefixedName, '--value-stdin'],
      getLocalStackEnv(),
      'stdin-updated-value'
    );

    expect(updateResult.code).toBe(0);
    expect(updateResult.stderr).toBe('');

    const deleteResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'delete',
        '-n',
        secret.prefixedName,
        '--force-delete-without-recovery',
        '--yes'
      ],
      getLocalStackEnv()
    );
    expect(deleteResult.code).toBe(0);
  });

  test('should create from a single-line env file and retrieve via aws -s', async () => {
    const secretName = `managed-secret-create-single-file-${Date.now()}`;
    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-create-single-${Date.now()}.env`
    );
    fs.writeFileSync(tempFile, 'GITHUB_PAT=github_pat_single_line');

    const createResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'create',
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

    const retrieveResult = await cliWithEnv(
      ['aws', '-s', secretName, 'echo', '$GITHUB_PAT'],
      getLocalStackEnv()
    );
    expect(retrieveResult.code).toBe(0);
    const envVars = JSON.parse(retrieveResult.stdout.trim()) as Record<
      string,
      string
    >;
    expect(envVars.GITHUB_PAT).toBe('github_pat_single_line');

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

  test('should create from a multi-line env file and retrieve via aws -s', async () => {
    const secretName = `managed-secret-create-multi-file-${Date.now()}`;
    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-create-multi-${Date.now()}.env`
    );
    fs.writeFileSync(
      tempFile,
      ['GITHUB_PAT=github_pat_multi_line', 'API_URL=https://example.com'].join(
        '\n'
      )
    );

    const createResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'create',
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

    const retrieveResult = await cliWithEnv(
      ['aws', '-s', secretName, 'echo', '$GITHUB_PAT'],
      getLocalStackEnv()
    );
    expect(retrieveResult.code).toBe(0);
    const envVars = JSON.parse(retrieveResult.stdout.trim()) as Record<
      string,
      string
    >;
    expect(envVars.GITHUB_PAT).toBe('github_pat_multi_line');
    expect(envVars.API_URL).toBe('https://example.com');

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

  test('should require confirmation for delete', async () => {
    const secret = await createTestSecret({
      name: `managed-secret-confirm-${Date.now()}`,
      value: 'value',
      description: 'Secret for delete confirmation test'
    });

    const result = await cliWithEnv(
      ['aws', 'secret', 'delete', '-n', secret.prefixedName],
      getLocalStackEnv()
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('requires --yes confirmation');
  });

  test('should honor region flag for secret list across multiple regions', async () => {
    const secret = await createTestSecret(
      {
        name: `managed-secret-multi-region-${Date.now()}`,
        value: '{"region":"us-west-2"}',
        description: 'Secret used for region isolation test'
      },
      'us-west-2'
    );

    const westResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'list',
        '--prefix',
        secret.prefixedName,
        '-r',
        'us-west-2',
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(westResult.code).toBe(0);
    const westRows = JSON.parse(westResult.stdout) as Array<{ name: string }>;
    expect(westRows.some((row) => row.name === secret.prefixedName)).toBe(true);

    const eastResult = await cliWithEnv(
      [
        'aws',
        'secret',
        'list',
        '--prefix',
        secret.prefixedName,
        '-r',
        'us-east-1',
        '--output',
        'json'
      ],
      getLocalStackEnv()
    );
    expect(eastResult.code).toBe(0);
    const eastRows = JSON.parse(eastResult.stdout) as Array<{ name: string }>;
    expect(eastRows).toEqual([]);
  });
});
