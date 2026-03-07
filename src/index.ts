#!/usr/bin/env node
/* istanbul ignore file */

import { Command, Argument } from 'commander';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import Debug from 'debug';

import { LIB_VERSION } from './version';
import { secretsmanager } from './vaults/secretsmanager';
import {
  createSecret,
  updateSecret,
  listSecrets,
  getSecretMetadata,
  deleteSecret,
  secretExists,
  getSecretString
} from './vaults/secretsmanager-admin';
import {
  asOutputFormat,
  parseEnvSecretsFile,
  printData,
  parseRecoveryDays,
  resolveAwsScope,
  resolveSecretValue
} from './cli/helpers';
import { objectToExport } from './vaults/utils';

const debug = Debug('env-secrets');

const program = new Command();

const exitWithError = (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
};

const parseSecretJsonObject = (
  secretName: string,
  value: string
): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      `Secret "${secretName}" is not valid JSON. append/remove requires a JSON object secret.`
    );
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(
      `Secret "${secretName}" must be a JSON object. append/remove does not support arrays or scalar values.`
    );
  }

  return parsed as Record<string, unknown>;
};

// main program
program
  .name('env-secrets')
  .description(
    'pull secrets from vaults and inject them into the running environment'
  )
  .version(LIB_VERSION);

// aws secretsmanager
const awsCommand = program
  .command('aws')
  .description('get secrets from AWS secrets manager')
  .addArgument(new Argument('[program...]', 'program to run'))
  .option('-s, --secret <secret>', 'secret to get')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option(
    '-o, --output <file>',
    'output secrets to file instead of environment variables'
  )
  .action(async (program, options) => {
    if (!options.secret) {
      exitWithError(
        new Error('Missing required option --secret for this command.')
      );
    }

    const secrets = await secretsmanager(options);
    debug(secrets);

    if (options.output) {
      // Check if file already exists
      if (existsSync(options.output)) {
        // eslint-disable-next-line no-console
        console.error(
          `Error: File ${options.output} already exists and will not be overwritten`
        );
        process.exit(1);
      }

      // Write secrets to file with 0400 permissions
      const envContent = objectToExport(secrets);
      writeFileSync(options.output, envContent, { mode: 0o400 });
      // eslint-disable-next-line no-console
      console.log(`Secrets written to ${options.output}`);
    } else {
      // Original behavior: merge secrets into environment and run program
      const env = Object.assign({}, process.env, secrets);
      debug(env);
      if (program && program.length > 0) {
        debug(`${program[0]} ${program.slice(1)}`);

        // In test mode, just output the environment variables for testing
        if (process.env.NODE_ENV === 'test') {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(env));
          return;
        }

        spawn(program[0], program.slice(1), {
          stdio: 'inherit',
          shell: true,
          env
        });
      }
    }
  });

const secretCommand = awsCommand
  .command('secret')
  .description('manage AWS secrets');

secretCommand
  .command('create')
  .description('create a secret in AWS Secrets Manager')
  .requiredOption('-n, --name <name>', 'secret name')
  .option('-v, --value <value>', 'secret value')
  .option('--value-stdin', 'read secret value from stdin')
  .option('-f, --file <path>', 'read secret value from local file')
  .option('-d, --description <description>', 'secret description')
  .option('-k, --kms-key-id <kmsKeyId>', 'kms key id')
  .option('-t, --tag <tag...>', 'tag in key=value format')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      const value = await resolveSecretValue(
        options.value,
        options.valueStdin,
        options.file
      );
      if (!value) {
        throw new Error(
          'Secret value is required. Provide --value, --value-stdin, or --file.'
        );
      }

      const result = await createSecret({
        name: options.name,
        value,
        description: options.description,
        kmsKeyId: options.kmsKeyId,
        tags: options.tag,
        profile,
        region
      });

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'arn', label: 'ARN' },
          { key: 'versionId', label: 'VersionId' }
        ],
        [result]
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

secretCommand
  .command('update')
  .description('update secret value or metadata')
  .requiredOption('-n, --name <name>', 'secret name')
  .option('-v, --value <value>', 'new secret value')
  .option('--value-stdin', 'read secret value from stdin')
  .option('-f, --file <path>', 'read secret value from local file')
  .option('-d, --description <description>', 'secret description')
  .option('-k, --kms-key-id <kmsKeyId>', 'kms key id')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      const value = await resolveSecretValue(
        options.value,
        options.valueStdin,
        options.file
      );
      if (!value && !options.description && !options.kmsKeyId) {
        throw new Error(
          'Nothing to update. Provide --value/--value-stdin/--file, --description, or --kms-key-id.'
        );
      }

      const result = await updateSecret({
        name: options.name,
        value,
        description: options.description,
        kmsKeyId: options.kmsKeyId,
        profile,
        region
      });

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'arn', label: 'ARN' },
          { key: 'versionId', label: 'VersionId' }
        ],
        [result]
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

secretCommand
  .command('upsert')
  .alias('import')
  .description('create or update a secret from a local env file')
  .requiredOption('-f, --file <path>', 'path to env file')
  .requiredOption('-n, --name <name>', 'secret name')
  .option('-d, --description <description>', 'secret description')
  .option('-k, --kms-key-id <kmsKeyId>', 'kms key id')
  .option('-t, --tag <tag...>', 'tag in key=value format (applies on create)')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      const parsed = await parseEnvSecretsFile(options.file);

      if (parsed.entries.length === 0) {
        throw new Error(
          'No env entries found. Include lines like KEY=value or export KEY=value.'
        );
      }

      const payload = Object.fromEntries(
        parsed.entries.map((entry) => [entry.key, entry.value])
      );
      const value = JSON.stringify(payload);
      const rows: Array<{
        name: string;
        status: 'created' | 'updated' | 'failed' | 'skipped';
        line?: string;
        message?: string;
      }> = [];
      let created = 0;
      let updated = 0;
      let failed = 0;
      const skipped = parsed.skipped.length;

      for (const skip of parsed.skipped) {
        rows.push({
          name: options.name,
          status: 'skipped',
          line: String(skip.line),
          message: `${skip.reason}: ${skip.key}`
        });
      }

      try {
        const exists = await secretExists({
          name: options.name,
          profile,
          region
        });
        if (exists) {
          await updateSecret({
            name: options.name,
            value,
            description: options.description,
            kmsKeyId: options.kmsKeyId,
            profile,
            region
          });
          updated += 1;
          rows.push({
            name: options.name,
            status: 'updated',
            message: `imported ${parsed.entries.length} keys`
          });
        } else {
          await createSecret({
            name: options.name,
            value,
            description: options.description,
            kmsKeyId: options.kmsKeyId,
            tags: options.tag,
            profile,
            region
          });
          created += 1;
          rows.push({
            name: options.name,
            status: 'created',
            message: `imported ${parsed.entries.length} keys`
          });
        }
      } catch (error: unknown) {
        failed += 1;
        rows.push({
          name: options.name,
          status: 'failed',
          message: error instanceof Error ? error.message : String(error)
        });
      }

      const summary = { created, updated, skipped, failed };
      if (output === 'json') {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ summary, results: rows }, null, 2));
        return;
      }

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
          { key: 'line', label: 'Line' },
          { key: 'message', label: 'Message' }
        ],
        rows
      );
      // eslint-disable-next-line no-console
      console.log(
        `Summary: created=${created}, updated=${updated}, skipped=${skipped}, failed=${failed}`
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

secretCommand
  .command('append')
  .description('append or overwrite one key in an existing JSON secret')
  .requiredOption('-n, --name <name>', 'secret name')
  .requiredOption('--key <key>', 'key to append/update')
  .option('-v, --value <value>', 'value for the key')
  .option('--value-stdin', 'read value from stdin')
  .option('-f, --file <path>', 'read value from local file')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      const value = await resolveSecretValue(
        options.value,
        options.valueStdin,
        options.file
      );
      if (!value) {
        throw new Error(
          'Append value is required. Provide --value, --value-stdin, or --file.'
        );
      }

      const current = await getSecretString({
        name: options.name,
        profile,
        region
      });
      const payload = parseSecretJsonObject(options.name, current);
      payload[options.key] = value;

      const result = await updateSecret({
        name: options.name,
        value: JSON.stringify(payload),
        profile,
        region
      });

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'arn', label: 'ARN' },
          { key: 'versionId', label: 'VersionId' },
          { key: 'key', label: 'Key' },
          { key: 'action', label: 'Action' }
        ],
        [
          {
            ...result,
            key: options.key,
            action: 'appended'
          }
        ]
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

secretCommand
  .command('remove')
  .description('remove one or more keys from an existing JSON secret')
  .requiredOption('-n, --name <name>', 'secret name')
  .requiredOption('--key <key...>', 'one or more keys to remove')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      const keys = options.key as string[];
      const current = await getSecretString({
        name: options.name,
        profile,
        region
      });
      const payload = parseSecretJsonObject(options.name, current);

      const removed: string[] = [];
      const missing: string[] = [];
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          delete payload[key];
          removed.push(key);
        } else {
          missing.push(key);
        }
      }

      if (removed.length === 0) {
        throw new Error(
          `None of the requested keys exist in secret "${options.name}".`
        );
      }

      const result = await updateSecret({
        name: options.name,
        value: JSON.stringify(payload),
        profile,
        region
      });

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'arn', label: 'ARN' },
          { key: 'versionId', label: 'VersionId' },
          { key: 'removed', label: 'RemovedKeys' },
          { key: 'missing', label: 'MissingKeys' }
        ],
        [
          {
            ...result,
            removed: removed.join(','),
            missing: missing.join(',')
          }
        ]
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

secretCommand
  .command('list')
  .description('list secrets in AWS Secrets Manager')
  .option('--prefix <prefix>', 'filter secrets by name prefix')
  .option('-t, --tag <tag...>', 'filter tags in key=value format')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      const result = await listSecrets({
        prefix: options.prefix,
        tags: options.tag,
        profile,
        region
      });
      const rows = result.map((secret) => ({
        name: secret.name,
        description: secret.description,
        lastChangedDate: secret.lastChangedDate
      }));

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'description', label: 'Description' },
          { key: 'lastChangedDate', label: 'LastChanged' }
        ],
        rows
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

secretCommand
  .command('get')
  .description('get secret metadata and version information')
  .requiredOption('-n, --name <name>', 'secret name')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      const result = await getSecretMetadata({
        name: options.name,
        profile,
        region
      });

      const row = {
        name: result.name,
        arn: result.arn,
        description: result.description,
        kmsKeyId: result.kmsKeyId,
        createdDate: result.createdDate,
        lastChangedDate: result.lastChangedDate,
        deletedDate: result.deletedDate
      };

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'arn', label: 'ARN' },
          { key: 'description', label: 'Description' },
          { key: 'kmsKeyId', label: 'KmsKeyId' },
          { key: 'createdDate', label: 'Created' },
          { key: 'lastChangedDate', label: 'LastChanged' },
          { key: 'deletedDate', label: 'Deleted' }
        ],
        [row]
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

secretCommand
  .command('delete')
  .description('delete a secret in AWS Secrets Manager')
  .requiredOption('-n, --name <name>', 'secret name')
  .option(
    '--recovery-days <days>',
    'recovery window in days (7-30)',
    parseRecoveryDays
  )
  .option(
    '--force-delete-without-recovery',
    'permanently delete secret without recovery window',
    false
  )
  .option('-y, --yes', 'confirm delete action', false)
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option('--output <format>', 'output format: json|table')
  .action(async (options, command) => {
    try {
      const { profile, region } = resolveAwsScope(options, command);
      const globalOptions = command.optsWithGlobals();
      const output =
        options.output ??
        (typeof globalOptions.output === 'string'
          ? globalOptions.output
          : 'table');
      if (!options.yes) {
        throw new Error('Delete requires --yes confirmation.');
      }

      if (options.recoveryDays && options.forceDeleteWithoutRecovery) {
        throw new Error(
          'Use either --recovery-days or --force-delete-without-recovery, not both.'
        );
      }

      const result = await deleteSecret({
        name: options.name,
        recoveryDays: options.recoveryDays,
        forceDeleteWithoutRecovery: options.forceDeleteWithoutRecovery,
        profile,
        region
      });

      printData(
        asOutputFormat(output),
        [
          { key: 'name', label: 'Name' },
          { key: 'arn', label: 'ARN' },
          { key: 'deletedDate', label: 'DeletedDate' }
        ],
        [result]
      );
    } catch (error: unknown) {
      exitWithError(error);
    }
  });

program.parse();
