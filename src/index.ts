#!/usr/bin/env node

import { Command, Argument } from 'commander';
import { spawn } from 'node:child_process';
import Debug from 'debug';

import { LIB_VERSION } from './version';
import { secretsmanager } from './vaults/secretsmanager';

const debug = Debug('env-secrets');

const program = new Command();

program
  .name('env-secrets')
  .description(
    'pull secrets from vaults and inject them into the running environment'
  )
  .version(LIB_VERSION);

program
  .command('aws')
  .description('get secrets from AWS secrets manager')
  .addArgument(new Argument('[program...]', 'program to run'))
  .requiredOption('-s, --secret <secret>', 'secret to get')
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .action(async (program, options) => {
    let env = await secretsmanager(options);
    env = Object.assign({}, process.env, env);
    debug(env);
    if (program && program.length > 0) {
      debug(`${program[0]} ${program.slice(1)}`);
      spawn(program[0], program.slice(1), {
        stdio: 'inherit',
        shell: true,
        env
      });
    }
  });

program.parse();
