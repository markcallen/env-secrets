import { cliWithEnv } from './utils/test-utils';
import { registerAwsE2eContext } from './utils/aws-e2e-context';

describe('AWS Program Execution CLI Args', () => {
  const { createTestSecret, getLocalStackEnv } = registerAwsE2eContext();

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

    const envVars = JSON.parse(result.stdout.trim()) as Record<string, string>;
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

    const envVars = JSON.parse(result.stdout.trim()) as Record<string, string>;
    expect(envVars.API_KEY).toBe('secret123');
  });
});
