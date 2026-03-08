import { cli } from './utils/test-utils';

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
