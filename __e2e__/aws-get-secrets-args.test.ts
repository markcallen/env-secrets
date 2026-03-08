import { cliWithEnv } from './utils/test-utils';
import { registerAwsE2eContext } from './utils/aws-e2e-context';

describe('AWS Get Secret CLI Args', () => {
  const { createTestSecret, getLocalStackEnv } = registerAwsE2eContext();

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

  test('should handle invalid AWS credentials', async () => {
    const result = await cliWithEnv(
      ['aws', '-s', 'test-secret-basic'],
      getLocalStackEnv({
        AWS_ACCESS_KEY_ID: 'invalid',
        AWS_SECRET_ACCESS_KEY: 'invalid'
      })
    );

    expect(result.code).toBe(0);
  });

  test('should handle missing secret parameter', async () => {
    const result = await cliWithEnv(['aws'], getLocalStackEnv());

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Missing required option --secret');
  });
});
