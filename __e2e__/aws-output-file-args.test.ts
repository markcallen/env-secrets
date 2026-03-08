import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  cliWithEnv,
  createTempFile,
  cleanupTempFile
} from './utils/test-utils';
import { registerAwsE2eContext } from './utils/aws-e2e-context';

describe('AWS Output File CLI Args', () => {
  const { createTestSecret, getLocalStackEnv } = registerAwsE2eContext();

  test('should write secrets to file', async () => {
    const secret = await createTestSecret({
      name: `test-secret-file-${Date.now()}`,
      value:
        '{"API_KEY": "secret123", "DATABASE_URL": "postgres://localhost:5432/test"}',
      description: 'Secret for file output test'
    });

    const tempFile = path.join(
      os.tmpdir(),
      `env-secrets-test-${Date.now()}.env`
    );

    const result = await cliWithEnv(
      ['aws', '-s', secret.prefixedName, '-o', tempFile],
      getLocalStackEnv()
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`Secrets written to ${tempFile}`);

    const fileContent = fs.readFileSync(tempFile, 'utf8');
    expect(fileContent).toContain('API_KEY=secret123');
    expect(fileContent).toContain(
      'DATABASE_URL=postgres://localhost:5432/test'
    );

    cleanupTempFile(tempFile);
  });

  test('should not overwrite existing file', async () => {
    const tempFile = createTempFile('existing content');

    try {
      const result = await cliWithEnv(
        ['aws', '-s', 'test-secret-basic', '-o', tempFile],
        getLocalStackEnv()
      );

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(
        'already exists and will not be overwritten'
      );

      const fileContent = fs.readFileSync(tempFile, 'utf8');
      expect(fileContent).toBe('existing content');
    } finally {
      cleanupTempFile(tempFile);
    }
  });
});
