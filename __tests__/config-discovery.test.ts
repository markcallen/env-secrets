import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findConfigFile, loadConfig } from '../src/config/loader';

describe('configuration discovery', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'env-secrets-config-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('discovers an ancestor config from nested directories', () => {
    const nested = join(root, 'app', 'src');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, '.env-secrets.yml'), 'provider: aws\nsecrets:\n  - name: example/dev\n');
    expect(findConfigFile(nested)).toBe(join(root, '.env-secrets.yml'));
    expect(loadConfig(nested)?.secrets[0].name).toBe('example/dev');
  });

  it('prefers the closest configuration', () => {
    const nested = join(root, 'app');
    mkdirSync(nested);
    writeFileSync(join(root, '.env-secrets.yml'), 'secrets:\n  - name: parent\n');
    writeFileSync(join(nested, '.env-secrets.json'), JSON.stringify({ secrets: [{ name: 'child' }] }));
    expect(loadConfig(nested)?.secrets[0].name).toBe('child');
  });

  it('uses an explicit path instead of discovered configuration', () => {
    writeFileSync(join(root, '.env-secrets.yml'), 'secrets:\n  - name: discovered\n');
    writeFileSync(join(root, 'custom.yml'), 'secrets:\n  - name: explicit\n');
    expect(loadConfig(root, 'custom.yml')?.secrets[0].name).toBe('explicit');
    expect(() => loadConfig(root, 'missing.yml')).toThrow();
  });
});
