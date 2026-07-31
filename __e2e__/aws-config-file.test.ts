import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cliWithEnv } from './utils/test-utils';
import { registerAwsE2eContext } from './utils/aws-e2e-context';

describe('AWS Config File E2E', () => {
  const { createTestSecret, getLocalStackEnv } = registerAwsE2eContext();

  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-secrets-config-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('loads a single secret defined in config file', async () => {
    const secret = await createTestSecret({
      name: `config-single-${Date.now()}`,
      value: '{"API_KEY": "from-config", "DB_PASS": "dbsecret"}'
    });

    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.yml'),
      `secrets:\n  - name: ${secret.prefixedName}\n`
    );

    const result = await cliWithEnv(
      ['aws', 'echo', 'test'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);
    const env = JSON.parse(result.stdout.trim()) as Record<string, string>;
    expect(env.API_KEY).toBe('from-config');
    expect(env.DB_PASS).toBe('dbsecret');
  });

  test('loads multiple secrets from config file and merges them', async () => {
    const ts = Date.now();
    const secret1 = await createTestSecret({
      name: `config-multi1-${ts}`,
      value: '{"API_KEY": "key-one"}'
    });
    const secret2 = await createTestSecret({
      name: `config-multi2-${ts}`,
      value: '{"DB_PASS": "pass-two"}'
    });

    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.yml'),
      `secrets:\n  - name: ${secret1.prefixedName}\n  - name: ${secret2.prefixedName}\n`
    );

    const result = await cliWithEnv(
      ['aws', 'echo', 'test'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);
    const env = JSON.parse(result.stdout.trim()) as Record<string, string>;
    expect(env.API_KEY).toBe('key-one');
    expect(env.DB_PASS).toBe('pass-two');
  });

  test('filters secret keys using the config keys list', async () => {
    const secret = await createTestSecret({
      name: `config-filter-${Date.now()}`,
      value:
        '{"API_KEY": "included", "DB_PASS": "excluded", "EXTRA": "also-excluded"}'
    });

    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.yml'),
      `secrets:\n  - name: ${secret.prefixedName}\n    keys:\n      - API_KEY\n`
    );

    const result = await cliWithEnv(
      ['aws', 'echo', 'test'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);
    const env = JSON.parse(result.stdout.trim()) as Record<string, string>;
    expect(env.API_KEY).toBe('included');
    expect(env.DB_PASS).toBeUndefined();
    expect(env.EXTRA).toBeUndefined();
  });

  test('CLI --secret overrides config secrets', async () => {
    const ts = Date.now();
    const configSecret = await createTestSecret({
      name: `config-override-cfg-${ts}`,
      value: '{"FROM_CONFIG": "config-value"}'
    });
    const cliSecret = await createTestSecret({
      name: `config-override-cli-${ts}`,
      value: '{"FROM_CLI": "cli-value"}'
    });

    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.yml'),
      `secrets:\n  - name: ${configSecret.prefixedName}\n`
    );

    const result = await cliWithEnv(
      ['aws', '-s', cliSecret.prefixedName, 'echo', 'test'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);
    const env = JSON.parse(result.stdout.trim()) as Record<string, string>;
    expect(env.FROM_CLI).toBe('cli-value');
    expect(env.FROM_CONFIG).toBeUndefined();
  });

  test('config profile/region apply even when --secret is given on CLI', async () => {
    const secret = await createTestSecret({
      name: `config-defaults-${Date.now()}`,
      value: '{"DEFAULTS_KEY": "defaults-value"}'
    });

    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.yml'),
      `profile: default\nregion: us-east-1\nsecrets:\n  - name: unused\n`
    );

    const result = await cliWithEnv(
      ['aws', '-s', secret.prefixedName, 'echo', 'test'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);
    const env = JSON.parse(result.stdout.trim()) as Record<string, string>;
    expect(env.DEFAULTS_KEY).toBe('defaults-value');
  });

  test('exits with error when config provider does not match aws command', async () => {
    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.yml'),
      `provider: gcp\nsecrets:\n  - name: some/secret\n`
    );

    const result = await cliWithEnv(['aws'], getLocalStackEnv(), tempDir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('provider');
    expect(result.stderr).toContain('gcp');
  });

  test('exits with error for invalid config YAML', async () => {
    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.yml'),
      `{ bad: yaml: :\n`
    );

    const result = await cliWithEnv(['aws'], getLocalStackEnv(), tempDir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('not valid YAML');
  });

  test('exits with error when no --secret and no config', async () => {
    const result = await cliWithEnv(['aws'], getLocalStackEnv(), tempDir);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Missing required option --secret');
  });

  test('accepts .env-secrets.json config format', async () => {
    const secret = await createTestSecret({
      name: `config-json-${Date.now()}`,
      value: '{"JSON_KEY": "json-value"}'
    });

    fs.writeFileSync(
      path.join(tempDir, '.env-secrets.json'),
      JSON.stringify({ secrets: [{ name: secret.prefixedName }] })
    );

    const result = await cliWithEnv(
      ['aws', 'echo', 'test'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);
    const env = JSON.parse(result.stdout.trim()) as Record<string, string>;
    expect(env.JSON_KEY).toBe('json-value');
  });

  test('creates config file from a secret name without keys', async () => {
    const secret = await createTestSecret({
      name: `config-create-${Date.now()}`,
      value: '{"API_KEY": "secret-value", "DB_PASS": "secret-pass"}'
    });

    const result = await cliWithEnv(
      ['aws', '-s', secret.prefixedName, '--create-config'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Config written to .env-secrets.yml');

    const configPath = path.join(tempDir, '.env-secrets.yml');
    const content = fs.readFileSync(configPath, 'utf8');
    expect(content).toContain('provider: aws');
    expect(content).toContain('region: us-east-1');
    expect(content).toContain(`name: ${secret.prefixedName}`);
    expect(content).not.toContain('keys:');
    expect(content).not.toContain('API_KEY');
    expect(content).not.toContain('DB_PASS');
  });

  test('creates config file at a custom path with provided region', async () => {
    const secret = await createTestSecret(
      {
        name: `config-create-region-${Date.now()}`,
        value: '{"REGION_KEY": "region-value"}'
      },
      'us-west-2'
    );

    const result = await cliWithEnv(
      [
        'aws',
        '-s',
        secret.prefixedName,
        '-r',
        'us-west-2',
        '--create-config',
        'custom.env-secrets.json'
      ],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(0);

    const content = fs.readFileSync(
      path.join(tempDir, 'custom.env-secrets.json'),
      'utf8'
    );
    expect(JSON.parse(content)).toEqual({
      provider: 'aws',
      region: 'us-west-2',
      secrets: [{ name: secret.prefixedName }]
    });
  });

  test('does not create config file when secret is not found', async () => {
    const result = await cliWithEnv(
      ['aws', '-s', 'missing-config-secret', '--create-config'],
      getLocalStackEnv(),
      tempDir
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('was not found');
    expect(fs.existsSync(path.join(tempDir, '.env-secrets.yml'))).toBe(false);
  });
});
