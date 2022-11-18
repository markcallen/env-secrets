#!/usr/bin/env node

import { Command } from 'commander';
import AWS from 'aws-sdk';
import { LIB_VERSION } from './version';
import { replaceWithAstrisk } from './utils';

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
  .option('-p, --profile <profile>', 'profile to use')
  .option('-r, --region <region>', 'region to use')
  .action((str) => {
    if (str.profile) {
      console.log(`Using ${str.profile}`);
      const credentials = new AWS.SharedIniFileCredentials({
        profile: str.profile
      });
      AWS.config.credentials = credentials;
    } else {
      const {
        AWS_ACCESS_KEY_ID: awsAccessKeyId,
        AWS_SECRET_ACCESS_KEY: awsSecretAccessKey,
        AWS_REGION: awsRegion
      } = process.env;
      console.log('No profile set using environment variables');
      console.log(`AWS_ACCESS_KEY_ID=${replaceWithAstrisk(awsAccessKeyId)}`);
      console.log(
        `AWS_SECRET_ACCESS_KEY=${replaceWithAstrisk(awsSecretAccessKey)}`
      );
      console.log(`AWS_REGION=${awsRegion}`);
    }
    if (str.region) {
      AWS.config.update({ region: str.region });
    }
    if (!AWS.config.region) {
      console.log('no region set');
    }
  });

program.parse();
