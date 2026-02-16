import {
  LocalStackHelper,
  cli,
  cliWithEnv,
  cliWithEnvAndStdin,
  createTempFile,
  cleanupTempFile,
  createTestProfile,
  restoreTestProfile,
  TestSecret,
  CreatedSecret
} from './utils/test-utils';
import { debugLog } from './utils/debug-logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('End-to-End Tests', () => {
  let localStack: LocalStackHelper;
  let awsDir: string | undefined;

  beforeAll(async () => {
    localStack = new LocalStackHelper();
    await localStack.waitForLocalStack();

    // Create test AWS profile
    awsDir = createTestProfile();
  });

  afterAll(async () => {
    // Clean up all secrets created during this test run
    await localStack.cleanupRunSecrets();

    // Restore AWS profile
    restoreTestProfile(awsDir);
  });

  // Helper function to create a secret for a test
  const createTestSecret = async (
    secret: TestSecret,
    region?: string
  ): Promise<CreatedSecret> => {
    return await localStack.createSecret(secret, region);
  };

  // Helper function to create LocalStack environment variables
  const getLocalStackEnv = (overrides: Record<string, string> = {}) => ({
    AWS_ENDPOINT_URL: process.env.LOCALSTACK_URL || 'http://localhost:4566',
    AWS_ACCESS_KEY_ID: 'test',
    AWS_SECRET_ACCESS_KEY: 'test',
    AWS_DEFAULT_REGION: 'us-east-1',
    ...overrides
  });

  describe('CLI Help Commands', () => {
    test('should show general help', async () => {
      const result = await cli(['-h']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('env-secrets');
      expect(result.stdout).toContain('pull secrets from vaults');
    });

    test('should show AWS command help', async () => {
      const result = await cli(['aws', '-h']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('get secrets from AWS secrets manager');
      expect(result.stdout).toContain('--secret');
    });

    test('should show version', async () => {
      const result = await cli(['--version']);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('AWS Secrets Manager Integration', () => {
    describe('Using Default AWS Credentials', () => {
      test('should retrieve basic JSON secret', async () => {
        const secret = await createTestSecret({
          name: 'test-secret-basic',
          value:
            '{"API_KEY": "secret123", "DATABASE_URL": "postgres://localhost:5432/test"}',
          description: 'Basic test secret with API key and database URL'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toBe('');
      });

      test('should retrieve simple string secret', async () => {
        const secret = await createTestSecret({
          name: 'test-secret-simple',
          value: 'simple-string-value',
          description: 'Simple string secret'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toBe('');
      });

      test('should retrieve complex JSON secret', async () => {
        const secret = await createTestSecret({
          name: 'test-secret-complex',
          value:
            '{"NESTED": {"KEY": "value"}, "ARRAY": [1, 2, 3], "BOOLEAN": true, "NUMBER": 42}',
          description: 'Complex JSON secret'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toBe('');
      });

      test('should retrieve secret with special characters', async () => {
        const secret = await createTestSecret({
          name: 'test-secret-special-chars',
          value:
            '{"PASSWORD": "p@ssw0rd!#$%", "URL": "https://api.example.com/v1?key=value&other=test"}',
          description: 'Secret with special characters'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toBe('');
      });

      test('should handle non-existent secret', async () => {
        const result = await cliWithEnv(
          ['aws', '-s', 'non-existent-secret'],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toContain('non-existent-secret not found');
      });

      test('should work with custom region', async () => {
        const secret = await createTestSecret(
          {
            name: `test-secret-region-${Date.now()}`,
            value:
              '{"API_KEY": "secret123", "DATABASE_URL": "postgres://localhost:5432/test"}',
            description: 'Basic test secret for us-west-2'
          },
          'us-west-2'
        );

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName, '-r', 'us-west-2'],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toBe('');
      });
    });

    describe('Using AWS Profile', () => {
      test('should retrieve secret using default profile', async () => {
        const secret = await createTestSecret({
          name: 'test-secret-profile',
          value:
            '{"API_KEY": "secret123", "DATABASE_URL": "postgres://localhost:5432/test"}',
          description: 'Secret for profile test'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toBe('');
      });

      test('should retrieve secret using custom profile', async () => {
        const secret = await createTestSecret({
          name: 'test-secret-profile-custom',
          value:
            '{"API_KEY": "secret123", "DATABASE_URL": "postgres://localhost:5432/test"}',
          description: 'Secret for custom profile test'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName, '-p', 'env-secrets-test'],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);
        expect(result.stderr).toBe('');
      });
    });

    describe('Output to File', () => {
      test('should write secrets to file', async () => {
        debugLog('Starting test...');

        const secret = await createTestSecret({
          name: `test-secret-file-${Date.now()}`,
          value:
            '{"API_KEY": "secret123", "DATABASE_URL": "postgres://localhost:5432/test"}',
          description: 'Secret for file output test'
        });
        debugLog('Secret created successfully');

        const tempFile = path.join(
          os.tmpdir(),
          `env-secrets-test-${Date.now()}.env`
        );

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName, '-o', tempFile],
          getLocalStackEnv()
        );

        debugLog('CLI result:', {
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr
        });
        expect(result.code).toBe(0);
        expect(result.stdout).toContain(`Secrets written to ${tempFile}`);

        // Verify file contents
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

          // Verify file was not modified
          const fileContent = fs.readFileSync(tempFile, 'utf8');
          expect(fileContent).toBe('existing content');
        } finally {
          cleanupTempFile(tempFile);
        }
      });
    });

    describe('Program Execution', () => {
      test('should execute program with injected environment variables', async () => {
        const secret = await createTestSecret({
          name: `test-secret-exec-${Date.now()}`,
          value:
            '{"API_KEY": "secret123", "DATABASE_URL": "postgres://localhost:5432/test"}',
          description: 'Secret for program execution test'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName, 'echo', '$API_KEY'],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);

        // In test mode, the CLI outputs the environment variables as JSON
        const envVars = JSON.parse(result.stdout.trim());
        expect(envVars.API_KEY).toBe('secret123');
        expect(envVars.DATABASE_URL).toBe('postgres://localhost:5432/test');
      });

      test('should handle program execution errors gracefully', async () => {
        const secret = await createTestSecret({
          name: `test-secret-error-${Date.now()}`,
          value: '{"API_KEY": "secret123"}',
          description: 'Secret for error handling test'
        });

        const result = await cliWithEnv(
          ['aws', '-s', secret.prefixedName, 'nonexistent-command'],
          getLocalStackEnv()
        );

        expect(result.code).toBe(0);

        // In test mode, the CLI outputs the environment variables as JSON
        const envVars = JSON.parse(result.stdout.trim());
        expect(envVars.API_KEY).toBe('secret123');
      });
    });

    describe('Error Handling', () => {
      test('should handle invalid AWS credentials', async () => {
        const result = await cliWithEnv(
          ['aws', '-s', 'test-secret-basic'],
          getLocalStackEnv({
            AWS_ACCESS_KEY_ID: 'invalid',
            AWS_SECRET_ACCESS_KEY: 'invalid'
          })
        );

        // LocalStack accepts any credentials, so this should succeed
        expect(result.code).toBe(0);
      });

      test('should handle missing secret parameter', async () => {
        const result = await cliWithEnv(['aws'], getLocalStackEnv());

        expect(result.code).toBe(1);
        expect(result.stderr).toContain('Missing required option --secret');
      });
    });

    describe('AWS Secret Management Commands', () => {
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
          [
            'aws',
            'secret',
            'update',
            '-n',
            secret.prefixedName,
            '--value-stdin'
          ],
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
        const westRows = JSON.parse(westResult.stdout) as Array<{
          name: string;
        }>;
        expect(westRows.some((row) => row.name === secret.prefixedName)).toBe(
          true
        );

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
        const eastRows = JSON.parse(eastResult.stdout) as Array<{
          name: string;
        }>;
        expect(eastRows).toEqual([]);
      });
    });
  });
});
