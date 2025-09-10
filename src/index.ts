#!/usr/bin/env node

import { Command, Argument } from 'commander';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import Debug from 'debug';

import { LIB_VERSION } from './version';
import { secretsmanager } from './vaults/secretsmanager';
import { objectToExport } from './vaults/utils';

const debug = Debug('env-secrets');

const program = new Command();

// main program
program
  .name('env-secrets')
  .description(
    'pull secrets from vaults and inject them into the running environment'
  )
  .version(LIB_VERSION);

// aws secretsmanager
program
  .command('aws')
  .description('get secrets from AWS secrets manager')
  .addArgument(new Argument('[program...]', 'program to run'))
  .requiredOption('-s, --secret <secret>', 'secret to get')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .option(
    '-o, --output <file>',
    'output secrets to file instead of environment variables'
  )
  .action(async (program, options) => {
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

program.parse();
