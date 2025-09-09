import * as os from 'os';
import {
  replaceWithAstrisk,
  objectToExport,
  objectToEnv
} from '../../src/vaults/utils';

describe('vaults utils', () => {
  describe('replaceWithAstrisk', () => {
    test('should return undefined for undefined input', () => {
      expect(replaceWithAstrisk(undefined)).toBeUndefined();
    });

    test('should return undefined for empty string', () => {
      expect(replaceWithAstrisk('')).toBeUndefined();
    });

    test('should mask middle characters for strings longer than 4 characters', () => {
      expect(replaceWithAstrisk('password123')).toBe('p******d123');
      expect(replaceWithAstrisk('secretkey')).toBe('s****tkey');
      expect(replaceWithAstrisk('verylongpassword')).toBe('v***********word');
    });

    test('should not mask characters for strings 4 characters or shorter', () => {
      expect(replaceWithAstrisk('1234')).toBe('1234');
      expect(replaceWithAstrisk('abc')).toBe('abc');
      expect(replaceWithAstrisk('a')).toBe('a');
    });

    test('should preserve first and last 4 characters for longer strings', () => {
      expect(replaceWithAstrisk('abcdefghijklmnop')).toBe('a***********mnop');
      expect(replaceWithAstrisk('1234567890123456')).toBe('1***********3456');
    });

    test('should handle special characters and unicode', () => {
      expect(replaceWithAstrisk('p@ssw0rd!')).toBe('p****0rd!');
      expect(replaceWithAstrisk('🔑secret🔒')).toBe('🔑*****t🔒');
    });
  });

  describe('objectToExport', () => {
    test('should convert object to export statements', () => {
      const obj = {
        API_KEY: 'abc123',
        DATABASE_URL: 'postgres://localhost:5432/db',
        DEBUG: 'true'
      };

      const result = objectToExport(obj);
      const expected = `export API_KEY=abc123${os.EOL}export DATABASE_URL=postgres://localhost:5432/db${os.EOL}export DEBUG=true${os.EOL}`;

      expect(result).toBe(expected);
    });

    test('should handle empty object', () => {
      const obj = {};
      const result = objectToExport(obj);
      expect(result).toBe('');
    });

    test('should handle object with various value types', () => {
      const obj = {
        STRING: 'hello',
        NUMBER: 42,
        BOOLEAN: true,
        NULL: null,
        UNDEFINED: undefined
      };

      const result = objectToExport(obj);
      const expected = `export STRING=hello${os.EOL}export NUMBER=42${os.EOL}export BOOLEAN=true${os.EOL}export NULL=null${os.EOL}export UNDEFINED=undefined${os.EOL}`;

      expect(result).toBe(expected);
    });

    test('should handle object with special characters in keys and values', () => {
      const obj = {
        'API-KEY': 'abc-123',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        DEBUG_MODE: 'true'
      };

      const result = objectToExport(obj);
      const expected = `export API-KEY=abc-123${os.EOL}export DATABASE_URL=postgres://user:pass@localhost:5432/db${os.EOL}export DEBUG_MODE=true${os.EOL}`;

      expect(result).toBe(expected);
    });
  });

  describe('objectToEnv', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should set environment variables from object', () => {
      const obj = {
        API_KEY: 'abc123',
        DATABASE_URL: 'postgres://localhost:5432/db',
        DEBUG: 'true'
      };

      const result = objectToEnv(obj);

      expect(process.env.API_KEY).toBe('abc123');
      expect(process.env.DATABASE_URL).toBe('postgres://localhost:5432/db');
      expect(process.env.DEBUG).toBe('true');
      expect(result).toEqual([
        'abc123',
        'postgres://localhost:5432/db',
        'true'
      ]);
    });

    test('should handle empty object', () => {
      const obj = {};
      const result = objectToEnv(obj);

      expect(result).toEqual([]);
    });

    test('should handle object with various value types', () => {
      const obj = {
        STRING: 'hello',
        NUMBER: 42,
        BOOLEAN: true,
        NULL: null,
        UNDEFINED: undefined
      };

      const result = objectToEnv(obj);

      expect(process.env.STRING).toBe('hello');
      expect(process.env.NUMBER).toBe('42');
      expect(process.env.BOOLEAN).toBe('true');
      expect(process.env.NULL).toBe('null');
      expect(process.env.UNDEFINED).toBe('undefined');
      expect(result).toEqual(['hello', '42', 'true', 'null', 'undefined']);
    });

    test('should overwrite existing environment variables', () => {
      // Set initial environment variable
      process.env.EXISTING_VAR = 'old_value';

      const obj = {
        EXISTING_VAR: 'new_value',
        NEW_VAR: 'new_var_value'
      };

      const result = objectToEnv(obj);

      expect(process.env.EXISTING_VAR).toBe('new_value');
      expect(process.env.NEW_VAR).toBe('new_var_value');
      expect(result).toEqual(['new_value', 'new_var_value']);
    });

    test('should handle object with special characters in keys and values', () => {
      const obj = {
        'API-KEY': 'abc-123',
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
        DEBUG_MODE: 'true'
      };

      const result = objectToEnv(obj);

      expect(process.env['API-KEY']).toBe('abc-123');
      expect(process.env['DATABASE_URL']).toBe(
        'postgres://user:pass@localhost:5432/db'
      );
      expect(process.env['DEBUG_MODE']).toBe('true');
      expect(result).toEqual([
        'abc-123',
        'postgres://user:pass@localhost:5432/db',
        'true'
      ]);
    });
  });
});
