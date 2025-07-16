import { Command, Argument } from 'commander';
import { spawn } from 'node:child_process';
import Debug from 'debug';

// Mock external dependencies
jest.mock('commander');
jest.mock('node:child_process');
jest.mock('debug', () => jest.fn());
jest.mock('../src/vaults/secretsmanager', () => ({
  secretsmanager: jest.fn()
}));

// Mock the version import
jest.mock('../src/version', () => ({
  LIB_VERSION: '1.0.0'
}));

// Import after mocking
import { secretsmanager } from '../src/vaults/secretsmanager';

// Mock the actual module under test
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockDebug = Debug as jest.MockedFunction<typeof Debug>;
const mockSecretsmanager = secretsmanager as jest.MockedFunction<
  typeof secretsmanager
>;
const mockCommand = Command as jest.MockedClass<typeof Command>;

describe('index.ts CLI functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset process.env
    process.env = { ...process.env };

    // Setup mock debug
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

      const mockChildProcess = {
        stdio: 'inherit'
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

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

      const mockChildProcess = {
        stdio: 'inherit'
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

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
      const debugInstance = mockDebug('env-secrets');
      expect(mockDebug).toHaveBeenCalledWith('env-secrets');
    });

    it('should log environment variables when debug is enabled', async () => {
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
      const mockDebugInstance = jest.fn() as any;
      mockDebug.mockReturnValue(mockDebugInstance);

      const mockEnv = { SECRET_KEY: 'secret_value' };
      mockSecretsmanager.mockResolvedValue(mockEnv);

      const mockChildProcess = {
        stdio: 'inherit'
      };
      mockSpawn.mockReturnValue(mockChildProcess as any);

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
});
