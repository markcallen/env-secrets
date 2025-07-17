import { LIB_VERSION } from '../src/version';
import packageJson from '../package.json';

describe('LIB_VERSION', () => {
  it('should match the version in package.json', () => {
    expect(LIB_VERSION).toBe(packageJson.version);
  });
});
