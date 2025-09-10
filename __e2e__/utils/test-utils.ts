import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { debugLog, debugError, debugWarn } from './debug-logger';

const execAsync = promisify(exec);

// Generate a unique character string for this test run
export function generateUniqueRunId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// Enhanced error class for awslocal command failures
export class AwslocalCommandError extends Error {
  public readonly command: string;
  public readonly exitCode: number;
  public readonly stdout: string;
  public readonly stderr: string;
  public readonly environment: Record<string, string>;

  constructor(
    command: string,
    exitCode: number,
    stdout: string,
    stderr: string,
    environment: Record<string, string>,
    originalError?: Error
  ) {
    const message =
      `awslocal command failed with exit code ${exitCode}\n` +
      `Command: ${command}\n` +
      `Exit Code: ${exitCode}\n` +
      `Stdout: ${stdout || '(empty)'}\n` +
      `Stderr: ${stderr || '(empty)'}\n` +
      `Environment: ${JSON.stringify(environment, null, 2)}`;

    super(message);
    this.name = 'AwslocalCommandError';
    this.command = command;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.environment = environment;

    // Preserve original error stack if available
    if (originalError && originalError.stack) {
      this.stack = originalError.stack;
    }
  }
}

// Enhanced execAsync function with better error handling
export async function execAwslocalCommand(
  command: string,
  environment: Record<string, string> = {},
  options: { timeout?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env, ...environment };
  const execOptions = {
    env,
    timeout: options.timeout || 30000, // 30 second default timeout
    cwd: options.cwd || process.cwd(),
    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
  };

  debugLog(`Executing awslocal command: ${command}`);
  debugLog(`Environment: ${JSON.stringify(environment, null, 2)}`);

  try {
    const result = await execAsync(command, execOptions);
    debugLog(`Command succeeded: ${command}`);
    if (result.stdout) {
      debugLog(`Stdout: ${result.stdout}`);
    }
    return result;
  } catch (error) {
    const execError = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    const exitCode = execError.code || -1;
    const stdout = execError.stdout || '';
    const stderr = execError.stderr || '';

    debugError(`Command failed: ${command}`);
    debugError(`Exit code: ${exitCode}`);
    debugError(`Stdout: ${stdout}`);
    debugError(`Stderr: ${stderr}`);

    throw new AwslocalCommandError(
      command,
      exitCode,
      stdout,
      stderr,
      environment,
      execError as Error
    );
  }
}

export interface CliResult {
  code: number;
  error: Error | null;
  stdout: string;
  stderr: string;
}

export interface TestSecret {
  name: string;
  value: string;
  description?: string;
}

export interface CreatedSecret {
  originalName: string;
  prefixedName: string;
  value: string;
  description?: string;
}

export class LocalStackHelper {
  private readonly endpoint: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly runId: string;

  constructor() {
    this.endpoint = process.env.LOCALSTACK_URL || 'http://localhost:4566';
    this.region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    this.accessKey = process.env.AWS_ACCESS_KEY_ID || 'test';
    this.secretKey = process.env.AWS_SECRET_ACCESS_KEY || 'test';
    this.runId = generateUniqueRunId();
  }

  private getEnvironment(): Record<string, string> {
    return {
      AWS_ENDPOINT_URL: this.endpoint,
      AWS_ACCESS_KEY_ID: this.accessKey,
      AWS_SECRET_ACCESS_KEY: this.secretKey,
      AWS_DEFAULT_REGION: this.region,
      AWS_REGION: this.region
    };
  }

  async createSecret(
    secret: TestSecret,
    region?: string
  ): Promise<CreatedSecret> {
    // Try to parse as JSON, if it fails, treat as plain string
    let secretValue: string;
    try {
      JSON.parse(secret.value);
      secretValue = secret.value; // Already valid JSON
    } catch {
      secretValue = JSON.stringify(secret.value); // Wrap plain string in quotes
    }

    // Prepend unique run ID to secret name
    const prefixedSecretName = `${this.runId}-${secret.name}`;

    const secretRegion = region || this.region;
    const command = `awslocal secretsmanager create-secret --name "${prefixedSecretName}" --secret-string '${secretValue}' --description "${
      secret.description || 'Test secret'
    }" --region ${secretRegion}`;

    try {
      await execAwslocalCommand(command, this.getEnvironment());
      debugLog(`Secret created successfully: ${prefixedSecretName}`);

      return {
        originalName: secret.name,
        prefixedName: prefixedSecretName,
        value: secret.value,
        description: secret.description
      };
    } catch (error) {
      if (error instanceof AwslocalCommandError) {
        debugError(`Failed to create secret ${secret.name}:`);
        debugError(`Command: ${error.command}`);
        debugError(`Exit Code: ${error.exitCode}`);
        debugError(`Stdout: ${error.stdout}`);
        debugError(`Stderr: ${error.stderr}`);
        debugError(
          `Environment: ${JSON.stringify(error.environment, null, 2)}`
        );

        // Provide helpful debugging information
        if (error.stderr.includes('already exists')) {
          debugLog(
            `Hint: Secret '${prefixedSecretName}' may already exist. Try deleting it first or use a different name.`
          );
        } else if (
          error.stderr.includes('connection') ||
          error.stderr.includes('timeout')
        ) {
          debugLog(`Hint: Check if LocalStack is running at ${this.endpoint}`);
          debugLog(`Hint: Try running: awslocal sts get-caller-identity`);
        } else if (
          error.stderr.includes('not found') ||
          error.stderr.includes('command not found')
        ) {
          debugLog(
            `Hint: Make sure awslocal is installed: pip install awscli-local`
          );
        }
      } else {
        debugLog(
          `Unexpected error creating secret ${prefixedSecretName}:`,
          error
        );
      }
      throw error;
    }
  }

  async deleteSecret(secretName: string): Promise<void> {
    // Prepend unique run ID to secret name if not already prefixed
    const prefixedSecretName = secretName.startsWith(`${this.runId}-`)
      ? secretName
      : `${this.runId}-${secretName}`;

    const command = `awslocal secretsmanager delete-secret --secret-id "${prefixedSecretName}" --force-delete-without-recovery --region ${this.region}`;

    try {
      await execAwslocalCommand(command, this.getEnvironment());
      debugLog(`Secret deleted successfully: ${prefixedSecretName}`);
    } catch (error) {
      if (error instanceof AwslocalCommandError) {
        // For cleanup operations, we log warnings but don't throw unless it's critical
        debugWarn(`Failed to delete secret ${prefixedSecretName}:`);
        debugWarn(`Command: ${error.command}`);
        debugWarn(`Exit Code: ${error.exitCode}`);
        debugWarn(`Stdout: ${error.stdout}`);
        debugWarn(`Stderr: ${error.stderr}`);

        // Only throw for critical errors (not "not found" errors)
        if (
          !error.stderr.includes('not found') &&
          !error.stderr.includes('does not exist')
        ) {
          debugLog(`Critical error during cleanup - rethrowing`);
          throw error;
        }
      } else {
        debugLog(
          `Unexpected error deleting secret ${prefixedSecretName}:`,
          error
        );
      }
    }
  }

  async cleanupRunSecrets(): Promise<void> {
    debugLog(`Cleaning up secrets with prefix: ${this.runId}`);

    try {
      const allSecrets = await this.listSecrets();
      const runSecrets = allSecrets.filter((secretName) =>
        secretName.startsWith(`${this.runId}-`)
      );

      debugLog(
        `Found ${runSecrets.length} secrets to cleanup for run ${this.runId}`
      );

      // Delete all secrets with the run prefix
      for (const secretName of runSecrets) {
        try {
          await this.deleteSecret(secretName);
        } catch (error) {
          debugWarn(`Failed to cleanup secret ${secretName}:`, error);
          // Continue with other secrets even if one fails
        }
      }

      debugLog(`Cleanup completed for run ${this.runId}`);
    } catch (error) {
      debugWarn(`Failed to cleanup secrets for run ${this.runId}:`, error);
      // Don't throw - cleanup failures shouldn't break tests
    }
  }

  async listSecrets(): Promise<string[]> {
    const command = `awslocal secretsmanager list-secrets --region ${this.region}`;

    try {
      const result = await execAwslocalCommand(command, this.getEnvironment());
      const parsedResult = JSON.parse(result.stdout);
      return (
        parsedResult.SecretList?.map(
          (secret: { Name: string }) => secret.Name
        ) || []
      );
    } catch (error) {
      if (error instanceof AwslocalCommandError) {
        debugError('Failed to list secrets:');
        debugError(`Command: ${error.command}`);
        debugError(`Exit Code: ${error.exitCode}`);
        debugError(`Stdout: ${error.stdout}`);
        debugError(`Stderr: ${error.stderr}`);
        debugError(
          `Environment: ${JSON.stringify(error.environment, null, 2)}`
        );

        // Provide helpful debugging information
        if (
          error.stderr.includes('connection') ||
          error.stderr.includes('timeout')
        ) {
          debugLog(`Hint: Check if LocalStack is running at ${this.endpoint}`);
          debugLog(`Hint: Try running: awslocal sts get-caller-identity`);
        } else if (
          error.stderr.includes('not found') ||
          error.stderr.includes('command not found')
        ) {
          debugLog(
            `Hint: Make sure awslocal is installed: pip install awscli-local`
          );
        }
      } else {
        debugLog('Unexpected error listing secrets:', error);
      }

      // Return empty array for non-critical errors to allow tests to continue
      return [];
    }
  }

  async waitForLocalStack(): Promise<void> {
    const maxRetries = 30;
    const retryDelay = 1000; // 1 second

    debugLog(`Waiting for LocalStack at ${this.endpoint}...`);

    for (let i = 0; i < maxRetries; i++) {
      try {
        const command = `awslocal sts get-caller-identity --region ${this.region}`;
        debugLog(`Testing LocalStack connectivity with: ${command}`);

        const result = await execAwslocalCommand(
          command,
          this.getEnvironment()
        );
        debugLog('LocalStack is ready');
        if (result.stdout) {
          debugLog(`LocalStack response: ${result.stdout}`);
        }
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          debugError('LocalStack failed to start within timeout');

          if (error instanceof AwslocalCommandError) {
            debugError(`Last command: ${error.command}`);
            debugError(`Last exit code: ${error.exitCode}`);
            debugError(`Last stdout: ${error.stdout}`);
            debugError(`Last stderr: ${error.stderr}`);
            debugError(
              `Environment: ${JSON.stringify(error.environment, null, 2)}`
            );

            // Provide comprehensive debugging information
            debugLog('\n=== LocalStack Debugging Information ===');
            debugLog(`Endpoint: ${this.endpoint}`);
            debugLog(`Region: ${this.region}`);
            debugLog(`Access Key: ${this.accessKey}`);
            debugLog(`Secret Key: ${this.secretKey}`);
            debugLog('\n=== Troubleshooting Steps ===');
            debugLog('1. Check if LocalStack is running:');
            debugLog('   docker-compose ps');
            debugLog('2. Check LocalStack logs:');
            debugLog('   docker-compose logs localstack');
            debugLog('3. Test awslocal installation:');
            debugLog('   awslocal --version');
            debugLog('4. Test direct connectivity:');
            debugLog(`   curl ${this.endpoint}/health`);
            debugLog('5. Check if port 4566 is accessible:');
            debugLog('   netstat -tlnp | grep 4566');
          } else {
            debugLog(`Last error: ${error.message}`);
          }

          throw new Error('LocalStack failed to start within timeout');
        }

        debugLog(`Waiting for LocalStack... (${i + 1}/${maxRetries})`);
        if (error instanceof AwslocalCommandError && error.stderr) {
          debugLog(`Error: ${error.stderr}`);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }
}

export async function cli(args: string[], cwd = '.'): Promise<CliResult> {
  return new Promise((resolve) => {
    // Clean environment by removing AWS variables that might interfere
    const cleanEnv = { ...process.env };
    delete cleanEnv.AWS_PROFILE;
    delete cleanEnv.AWS_DEFAULT_PROFILE;
    delete cleanEnv.AWS_SESSION_TOKEN;
    delete cleanEnv.AWS_SECURITY_TOKEN;
    delete cleanEnv.AWS_ROLE_ARN;
    delete cleanEnv.AWS_ROLE_SESSION_NAME;
    delete cleanEnv.AWS_WEB_IDENTITY_TOKEN_FILE;
    delete cleanEnv.AWS_WEB_IDENTITY_TOKEN;

    // Default environment variables for LocalStack
    const defaultEnv = {
      AWS_ENDPOINT_URL: process.env.LOCALSTACK_URL || 'http://localhost:4566',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_REGION: 'us-east-1',
      NODE_ENV: 'test'
    };

    const envVars = { ...cleanEnv, ...defaultEnv };
    const command = `node ${path.resolve('./dist/index')} ${args.join(' ')}`;

    debugLog(`Running CLI command: ${command}`);
    debugLog(
      `Environment: AWS_ENDPOINT_URL=${envVars.AWS_ENDPOINT_URL}, AWS_DEFAULT_REGION=${envVars.AWS_DEFAULT_REGION}`
    );

    exec(command, { cwd, env: envVars }, (error, stdout, stderr) => {
      const result = {
        code: error && error.code ? error.code : 0,
        error: error || null,
        stdout,
        stderr
      };

      if (result.code !== 0) {
        debugError(`CLI command failed with code ${result.code}`);
        debugError(`Command: ${command}`);
        debugError(`Stdout: ${result.stdout}`);
        debugError(`Stderr: ${result.stderr}`);
      }

      resolve(result);
    });
  });
}

export async function cliWithEnv(
  args: string[],
  env: Record<string, string>,
  cwd = '.'
): Promise<CliResult> {
  return new Promise((resolve) => {
    // Clean environment by removing AWS variables that might interfere
    const cleanEnv = { ...process.env };
    delete cleanEnv.AWS_PROFILE;
    delete cleanEnv.AWS_DEFAULT_PROFILE;
    delete cleanEnv.AWS_SESSION_TOKEN;
    delete cleanEnv.AWS_SECURITY_TOKEN;
    delete cleanEnv.AWS_ROLE_ARN;
    delete cleanEnv.AWS_ROLE_SESSION_NAME;
    delete cleanEnv.AWS_WEB_IDENTITY_TOKEN_FILE;
    delete cleanEnv.AWS_WEB_IDENTITY_TOKEN;

    // Default environment variables for LocalStack
    const defaultEnv = {
      AWS_ENDPOINT_URL: process.env.LOCALSTACK_URL || 'http://localhost:4566',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
      AWS_DEFAULT_REGION: 'us-east-1',
      AWS_REGION: 'us-east-1',
      NODE_ENV: 'test'
    };

    const envVars = { ...cleanEnv, ...defaultEnv, ...env };
    const command = `node ${path.resolve('./dist/index')} ${args.join(' ')}`;

    debugLog(`Running CLI command with custom env: ${command}`);
    debugLog(
      `Environment: AWS_ENDPOINT_URL=${envVars.AWS_ENDPOINT_URL}, AWS_DEFAULT_REGION=${envVars.AWS_DEFAULT_REGION}`
    );
    debugLog(`Custom env vars:`, Object.keys(env));

    exec(command, { cwd, env: envVars }, (error, stdout, stderr) => {
      const result = {
        code: error && error.code ? error.code : 0,
        error: error || null,
        stdout,
        stderr
      };

      if (result.code !== 0) {
        debugError(`CLI command failed with code ${result.code}`);
        debugError(`Command: ${command}`);
        debugError(`Stdout: ${result.stdout}`);
        debugError(`Stderr: ${result.stderr}`);
      }

      resolve(result);
    });
  });
}

export function createTempFile(content: string) {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `env-secrets-test-${Date.now()}.env`);
  fs.writeFileSync(tempFile, content);
  return tempFile;
}

export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    debugWarn(`Failed to cleanup temp file ${filePath}:`, error);
  }
}

export function createTestProfile() {
  const homeDir = os.homedir();
  const awsDir = path.join(homeDir, '.aws');
  const credentialsFile = path.join(awsDir, 'credentials');
  const configFile = path.join(awsDir, 'config');

  // Create .aws directory if it doesn't exist
  if (!fs.existsSync(awsDir)) {
    fs.mkdirSync(awsDir, { mode: 0o700 });
  }

  // Backup existing files if they exist
  const backupCredentials = credentialsFile + '.backup';
  const backupConfig = configFile + '.backup';

  if (fs.existsSync(credentialsFile)) {
    fs.copyFileSync(credentialsFile, backupCredentials);
  }
  if (fs.existsSync(configFile)) {
    fs.copyFileSync(configFile, backupConfig);
  }

  // Create test profile
  const credentialsContent = `[default]
aws_access_key_id = test
aws_secret_access_key = test

[env-secrets-test]
aws_access_key_id = test
aws_secret_access_key = test
`;

  const configContent = `[default]
region = us-east-1

[profile env-secrets-test]
region = us-east-1
`;

  fs.writeFileSync(credentialsFile, credentialsContent, { mode: 0o600 });
  fs.writeFileSync(configFile, configContent, { mode: 0o600 });

  return awsDir;
}

export function restoreTestProfile(awsDir: string | undefined): void {
  if (!awsDir) {
    debugWarn('No AWS directory provided for profile restoration');
    return;
  }

  const credentialsFile = path.join(awsDir, 'credentials');
  const configFile = path.join(awsDir, 'config');
  const backupCredentials = credentialsFile + '.backup';
  const backupConfig = configFile + '.backup';

  try {
    if (fs.existsSync(backupCredentials)) {
      fs.copyFileSync(backupCredentials, credentialsFile);
      fs.unlinkSync(backupCredentials);
    } else if (fs.existsSync(credentialsFile)) {
      fs.unlinkSync(credentialsFile);
    }

    if (fs.existsSync(backupConfig)) {
      fs.copyFileSync(backupConfig, configFile);
      fs.unlinkSync(backupConfig);
    } else if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
    }
  } catch (error) {
    debugWarn('Failed to restore AWS profile:', error);
  }
}

export async function checkAwslocalInstalled(): Promise<void> {
  try {
    await execAwslocalCommand('awslocal --version', {});
    debugLog('awslocal is installed and available');
  } catch (error) {
    debugLog('awslocal is not installed or not available in PATH');
    debugLog('');

    if (error instanceof AwslocalCommandError) {
      debugError(`Command: ${error.command}`);
      debugError(`Exit Code: ${error.exitCode}`);
      debugError(`Stdout: ${error.stdout}`);
      debugError(`Stderr: ${error.stderr}`);
    } else {
      debugError(`Error: ${error.message}`);
    }

    debugLog('');
    debugLog('Please install awslocal by running:');
    debugLog('  pip install awscli-local');
    debugLog('');
    debugLog('Or using npm:');
    debugLog('  npm install -g awscli-local');
    debugLog('');
    debugLog(
      'For more information, visit: https://github.com/localstack/awscli-local'
    );
    debugLog('');
    debugLog('=== Troubleshooting Steps ===');
    debugLog('1. Verify Python/pip is installed:');
    debugLog('   python --version');
    debugLog('   pip --version');
    debugLog('2. Try installing with sudo if needed:');
    debugLog('   sudo pip install awscli-local');
    debugLog('3. Check if awslocal is in your PATH:');
    debugLog('   which awslocal');
    debugLog('   echo $PATH');
    debugLog('4. Try using the full path:');
    debugLog('   /usr/local/bin/awslocal --version');

    throw new Error(
      'awslocal is required for end-to-end tests but is not installed'
    );
  }
}
