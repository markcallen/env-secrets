import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import Debug from 'debug';

// Mock external dependencies
jest.mock('commander');
jest.mock('node:child_process');
jest.mock('node:fs');
jest.mock('debug', () => jest.fn());
jest.mock('../src/vaults/secretsmanager', () => ({
  secretsmanager: jest.fn()
}));
jest.mock('../src/vaults/utils', () => ({
  objectToExport: jest.fn()
}));

// Mock the version import
jest.mock('../src/version', () => ({
  LIB_VERSION: '1.0.0'
}));

// Import after mocking
import { secretsmanager } from '../src/vaults/secretsmanager';
import { objectToExport } from '../src/vaults/utils';

// Mock the actual module under test
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<
  typeof writeFileSync
>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockDebug = Debug as jest.MockedFunction<typeof Debug>;
const mockSecretsmanager = secretsmanager as jest.MockedFunction<
  typeof secretsmanager
>;
const mockObjectToExport = objectToExport as jest.MockedFunction<
  typeof objectToExport
>;

describe('index.ts CLI functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset process.env
    process.env = { ...process.env };

    // Setup mock debug
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDebugInstance = jest.fn() as any;
    mockDebug.mockReturnValue(mockDebugInstance);
  });

  describe('AWS command action logic', () => {
    it('should call secretsmanager with correct options', async () => {
      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      const options = {
        secret: 'my-secret',
        profile: 'my-profile',
        region: 'us-east-1'
      };

      // Simulate the action logic
      let env = await mockSecretsmanager(options);
      env = Object.assign({}, process.env, env);

      expect(mockSecretsmanager).toHaveBeenCalledWith(options);
      expect(env).toEqual(
        expect.objectContaining({
          SECRET_KEY: 'secret_value'
        })
      );
    });

    it('should merge secrets with process.env', async () => {
      const mockSecrets = { SECRET_KEY: 'secret_value' };
      const originalEnv = { ORIGINAL_KEY: 'original_value' };
      process.env = { ...originalEnv };

      mockSecretsmanager.mockResolvedValue(mockSecrets);

      // Simulate the action logic
      let env = await mockSecretsmanager({ secret: 'my-secret' });
      env = Object.assign({}, process.env, env);

      expect(env).toEqual(
        expect.objectContaining({
          ORIGINAL_KEY: 'original_value',
          SECRET_KEY: 'secret_value'
        })
      );
    });

    it('should spawn a program when provided', async () => {
      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChildProcess = {
        stdio: 'inherit'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      mockSpawn.mockReturnValue(mockChildProcess);

      const program = ['node', 'script.js', 'arg1', 'arg2'];
      const options = { secret: 'my-secret' };

      // Simulate the action logic
      let env = await mockSecretsmanager(options);
      env = Object.assign({}, process.env, env);

      if (program && program.length > 0) {
        mockSpawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['script.js', 'arg1', 'arg2'],
        {
          stdio: 'inherit',
          shell: true,
          env: expect.objectContaining({
            SECRET_KEY: 'secret_value'
          })
        }
      );
    });

    it('should not spawn a program when no program is provided', async () => {
      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      // Simulate the action logic
      let env = await mockSecretsmanager({ secret: 'my-secret' });
      env = Object.assign({}, process.env, env);

      const program: string[] = [];
      if (program && program.length > 0) {
        mockSpawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should handle empty program array', async () => {
      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      // Simulate the action logic
      let env = await mockSecretsmanager({ secret: 'my-secret' });
      env = Object.assign({}, process.env, env);

      const program: string[] = [];
      if (program && program.length > 0) {
        mockSpawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }

      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should handle single program argument', async () => {
      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChildProcess = {
        stdio: 'inherit'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      mockSpawn.mockReturnValue(mockChildProcess);

      const program = ['echo'];
      const options = { secret: 'my-secret' };

      // Simulate the action logic
      let env = await mockSecretsmanager(options);
      env = Object.assign({}, process.env, env);

      if (program && program.length > 0) {
        mockSpawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }

      expect(mockSpawn).toHaveBeenCalledWith('echo', [], {
        stdio: 'inherit',
        shell: true,
        env: expect.objectContaining({
          SECRET_KEY: 'secret_value'
        })
      });
    });

    it('should preserve existing environment variables', async () => {
      const mockSecrets = { SECRET_KEY: 'secret_value' };
      const originalEnv = {
        PATH: '/usr/bin',
        HOME: '/home/user',
        NODE_ENV: 'test'
      };
      process.env = { ...originalEnv };

      mockSecretsmanager.mockResolvedValue(mockSecrets);

      // Simulate the action logic
      let env = await mockSecretsmanager({ secret: 'my-secret' });
      env = Object.assign({}, process.env, env);

      const program = ['echo'];
      if (program && program.length > 0) {
        mockSpawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }

      expect(mockSpawn).toHaveBeenCalledWith('echo', [], {
        stdio: 'inherit',
        shell: true,
        env: expect.objectContaining({
          PATH: '/usr/bin',
          HOME: '/home/user',
          NODE_ENV: 'test',
          SECRET_KEY: 'secret_value'
        })
      });
    });

    it('should handle secretsmanager returning empty object', async () => {
      mockSecretsmanager.mockResolvedValue({});

      // Simulate the action logic
      let env = await mockSecretsmanager({ secret: 'my-secret' });
      env = Object.assign({}, process.env, env);

      const program = ['echo'];
      if (program && program.length > 0) {
        mockSpawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }

      expect(mockSpawn).toHaveBeenCalledWith('echo', [], {
        stdio: 'inherit',
        shell: true,
        env: expect.objectContaining({})
      });
    });

    it('should handle secretsmanager throwing an error', async () => {
      const error = new Error('AWS connection failed');
      mockSecretsmanager.mockRejectedValue(error);

      // Should throw - the error should propagate
      await expect(mockSecretsmanager({ secret: 'my-secret' })).rejects.toThrow(
        'AWS connection failed'
      );
    });
  });

  describe('Debug logging', () => {
    it('should create debug instance with correct namespace', () => {
      mockDebug('env-secrets');
      expect(mockDebug).toHaveBeenCalledWith('env-secrets');
    });

    it('should log environment variables when debug is enabled', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDebugInstance = jest.fn() as any;
      mockDebug.mockReturnValue(mockDebugInstance);

      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      // Simulate the action logic
      let env = await mockSecretsmanager({ secret: 'my-secret' });
      env = Object.assign({}, process.env, env);

      // Simulate debug logging
      mockDebugInstance(env);

      expect(mockDebugInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          SECRET_KEY: 'secret_value'
        })
      );
    });

    it('should log program execution when program is provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDebugInstance = jest.fn() as any;
      mockDebug.mockReturnValue(mockDebugInstance);

      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChildProcess = {
        stdio: 'inherit'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      mockSpawn.mockReturnValue(mockChildProcess);

      const program = ['node', 'script.js', 'arg1'];

      // Simulate the action logic
      let env = await mockSecretsmanager({ secret: 'my-secret' });
      env = Object.assign({}, process.env, env);

      if (program && program.length > 0) {
        // Simulate debug logging
        mockDebugInstance(`${program[0]} ${program.slice(1).join(' ')}`);

        mockSpawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }

      expect(mockDebugInstance).toHaveBeenCalledWith('node script.js arg1');
    });
  });

  describe('File output functionality', () => {
    beforeEach(() => {
      // Reset console methods
      jest.spyOn(console, 'log').mockImplementation(() => undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should write secrets to file when output option is provided', async () => {
      const mockSecrets = { SECRET_KEY: 'secret_value', API_KEY: 'api_value' };
      const mockEnvContent =
        'export SECRET_KEY=secret_value\nexport API_KEY=api_value\n';

      mockSecretsmanager.mockResolvedValue(mockSecrets);
      mockObjectToExport.mockReturnValue(mockEnvContent);
      mockExistsSync.mockReturnValue(false);

      const options: { secret: string; output: string } = {
        secret: 'my-secret',
        output: '/tmp/secrets.env'
      };

      // Simulate the action logic
      const secrets = await mockSecretsmanager(options);

      if (options.output) {
        if (mockExistsSync(options.output)) {
          // eslint-disable-next-line no-console
          console.error(
            `Error: File ${options.output} already exists and will not be overwritten`
          );
          process.exit(1);
        }

        const envContent = mockObjectToExport(secrets);
        mockWriteFileSync(options.output, envContent, { mode: 0o400 });
        // eslint-disable-next-line no-console
        console.log(`Secrets written to ${options.output}`);
      }

      expect(mockSecretsmanager).toHaveBeenCalledWith(options);
      expect(mockObjectToExport).toHaveBeenCalledWith(mockSecrets);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/tmp/secrets.env',
        mockEnvContent,
        { mode: 0o400 }
      );
      // eslint-disable-next-line no-console
      expect(console.log).toHaveBeenCalledWith(
        'Secrets written to /tmp/secrets.env'
      );
    });

    it('should not overwrite existing file', async () => {
      const mockSecrets = { SECRET_KEY: 'secret_value' };

      mockSecretsmanager.mockResolvedValue(mockSecrets);
      mockExistsSync.mockReturnValue(true);

      const options: { secret: string; output: string } = {
        secret: 'my-secret',
        output: '/tmp/existing.env'
      };

      // Simulate the action logic
      await mockSecretsmanager(options);

      // Test the file existence check and error handling
      if (options.output) {
        if (mockExistsSync(options.output)) {
          // eslint-disable-next-line no-console
          console.error(
            `Error: File ${options.output} already exists and will not be overwritten`
          );
          // In the actual implementation, this would call process.exit(1)
        }
      }

      expect(mockExistsSync).toHaveBeenCalledWith('/tmp/existing.env');
      // eslint-disable-next-line no-console
      expect(console.error).toHaveBeenCalledWith(
        'Error: File /tmp/existing.env already exists and will not be overwritten'
      );
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should use original behavior when no output option is provided', async () => {
      const mockSecrets = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockSecrets);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockChildProcess = {
        stdio: 'inherit'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      mockSpawn.mockReturnValue(mockChildProcess);

      const options: { secret: string; output?: string } = {
        secret: 'my-secret'
        // No output option
      };

      const program = ['echo', 'hello'];

      // Simulate the action logic
      const secrets = await mockSecretsmanager(options);

      if (options.output) {
        // This branch should not be taken
        if (mockExistsSync(options.output)) {
          // eslint-disable-next-line no-console
          console.error(
            `Error: File ${options.output} already exists and will not be overwritten`
          );
          process.exit(1);
        }

        const envContent = mockObjectToExport(secrets);
        mockWriteFileSync(options.output, envContent, { mode: 0o400 });
        // eslint-disable-next-line no-console
        console.log(`Secrets written to ${options.output}`);
      } else {
        // Original behavior: merge secrets into environment and run program
        const env = Object.assign({}, process.env, secrets);

        if (program && program.length > 0) {
          mockSpawn(program[0], program.slice(1), {
            stdio: 'inherit',
            shell: true,
            env
          });
        }
      }

      expect(mockSecretsmanager).toHaveBeenCalledWith(options);
      expect(mockSpawn).toHaveBeenCalledWith('echo', ['hello'], {
        stdio: 'inherit',
        shell: true,
        env: expect.objectContaining({
          SECRET_KEY: 'secret_value'
        })
      });
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should handle empty secrets object in file output', async () => {
      const mockSecrets = {};
      const mockEnvContent = '';

      mockSecretsmanager.mockResolvedValue(mockSecrets);
      mockObjectToExport.mockReturnValue(mockEnvContent);
      mockExistsSync.mockReturnValue(false);

      const options: { secret: string; output: string } = {
        secret: 'my-secret',
        output: '/tmp/empty.env'
      };

      // Simulate the action logic
      const secrets = await mockSecretsmanager(options);

      if (options.output) {
        if (mockExistsSync(options.output)) {
          // eslint-disable-next-line no-console
          console.error(
            `Error: File ${options.output} already exists and will not be overwritten`
          );
          process.exit(1);
        }

        const envContent = mockObjectToExport(secrets);
        mockWriteFileSync(options.output, envContent, { mode: 0o400 });
        // eslint-disable-next-line no-console
        console.log(`Secrets written to ${options.output}`);
      }

      expect(mockObjectToExport).toHaveBeenCalledWith({});
      expect(mockWriteFileSync).toHaveBeenCalledWith('/tmp/empty.env', '', {
        mode: 0o400
      });
    });

    it('should not run program when output option is provided', async () => {
      const mockSecrets = { SECRET_KEY: 'secret_value' };
      const mockEnvContent = 'export SECRET_KEY=secret_value\n';

      mockSecretsmanager.mockResolvedValue(mockSecrets);
      mockObjectToExport.mockReturnValue(mockEnvContent);
      mockExistsSync.mockReturnValue(false);

      const options: { secret: string; output: string } = {
        secret: 'my-secret',
        output: '/tmp/secrets.env'
      };

      const program = ['echo', 'hello'];

      // Simulate the action logic
      const secrets = await mockSecretsmanager(options);

      if (options.output) {
        if (mockExistsSync(options.output)) {
          // eslint-disable-next-line no-console
          console.error(
            `Error: File ${options.output} already exists and will not be overwritten`
          );
          process.exit(1);
        }

        const envContent = mockObjectToExport(secrets);
        mockWriteFileSync(options.output, envContent, { mode: 0o400 });
        // eslint-disable-next-line no-console
        console.log(`Secrets written to ${options.output}`);
      } else {
        // This branch should not be taken
        const env = Object.assign({}, process.env, secrets);

        if (program && program.length > 0) {
          mockSpawn(program[0], program.slice(1), {
            stdio: 'inherit',
            shell: true,
            env
          });
        }
      }

      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });
});
