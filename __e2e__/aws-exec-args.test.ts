import { cliWithEnv, cliWithRealSpawn } from './utils/test-utils';
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

describe('AWS Real Spawn Execution (no NODE_ENV=test)', () => {
  const { createTestSecret, getLocalStackEnv } = registerAwsE2eContext();

  test('injected env vars are visible to the spawned child process', async () => {
    const secret = await createTestSecret({
      name: `test-secret-realspawn-${Date.now()}`,
      value: '{"INJECTED_KEY": "injected_value"}',
      description: 'Real spawn env injection test'
    });

    const result = await cliWithRealSpawn(
      [
        'aws',
        '-s',
        secret.prefixedName,
        '--',
        'node',
        '-e',
        '"process.stdout.write(process.env.INJECTED_KEY + \'\\n\')"'
      ],
      getLocalStackEnv()
    );

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('injected_value');
  });

  test('exit code of child process is propagated on success', async () => {
    const secret = await createTestSecret({
      name: `test-secret-exitcode-ok-${Date.now()}`,
      value: '{"DUMMY": "1"}',
      description: 'Exit code propagation test (success)'
    });

    const result = await cliWithRealSpawn(
      [
        'aws',
        '-s',
        secret.prefixedName,
        '--',
        'node',
        '-e',
        '"process.exit(0)"'
      ],
      getLocalStackEnv()
    );

    expect(result.code).toBe(0);
  });

  test('exit code of child process is propagated on failure', async () => {
    const secret = await createTestSecret({
      name: `test-secret-exitcode-fail-${Date.now()}`,
      value: '{"DUMMY": "1"}',
      description: 'Exit code propagation test (failure)'
    });

    const result = await cliWithRealSpawn(
      [
        'aws',
        '-s',
        secret.prefixedName,
        '--',
        'node',
        '-e',
        '"process.exit(42)"'
      ],
      getLocalStackEnv()
    );

    expect(result.code).toBe(42);
  });

  test('--no-shell passes args directly and env is injected', async () => {
    const secret = await createTestSecret({
      name: `test-secret-noshell-${Date.now()}`,
      value: '{"INJECTED_KEY": "direct_value"}',
      description: 'No-shell spawn test'
    });

    const result = await cliWithRealSpawn(
      [
        'aws',
        '-s',
        secret.prefixedName,
        '--no-shell',
        '--',
        'node',
        '-e',
        'process.stdout.write(process.env.INJECTED_KEY+String.fromCharCode(10))'
      ],
      getLocalStackEnv()
    );

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('direct_value');
  });
});
