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
  deleteSecret
} from './vaults/secretsmanager-admin';
import {
  asOutputFormat,
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
      const value = await resolveSecretValue(options.value, options.valueStdin);
      if (!value) {
        throw new Error(
          'Secret value is required. Provide --value or --value-stdin.'
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
      const value = await resolveSecretValue(options.value, options.valueStdin);
      if (!value && !options.description && !options.kmsKeyId) {
        throw new Error(
          'Nothing to update. Provide --value/--value-stdin, --description, or --kms-key-id.'
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
