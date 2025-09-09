import * as path from 'path';
import { exec } from 'child_process';

type Cli = {
  code: number;
  error: Error;
  stdout: string;
  stderr: string;
};

describe('CLI tests', () => {
  test('general help', async () => {
    const result = await cli(['-h'], '.');
    expect(result.code).toBe(0);
  });
  test('aws help', async () => {
    const result = await cli(['aws -h'], '.');
    expect(result.code).toBe(0);
  });
});

function cli(args, cwd): Promise<Cli> {
  return new Promise((resolve) => {
    exec(
      `node ${path.resolve('./dist/index')} ${args.join(' ')}`,
      { cwd },
      (error, stdout, stderr) => {
        resolve({
          code: error && error.code ? error.code : 0,
          error: error || new Error(),
          stdout,
          stderr
        });
      }
    );
  });
}
