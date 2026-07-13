import * as fs from 'fs';
import { execSync } from 'child_process';

export async function promptTty(prompt: string): Promise<string> {
  let fd: number;
  try {
    fd = fs.openSync('/dev/tty', 'r+');
  } catch {
    throw new Error(
      '/dev/tty is unavailable. Cannot prompt for secret value securely.'
    );
  }

  try {
    // Pass fd as stdin so stty targets the /dev/tty we opened, not the MCP stdio pipe.
    execSync('stty -echo', { stdio: [fd, 'inherit', 'inherit'] });
    fs.writeSync(fd, prompt);

    const chunks: Buffer[] = [];
    const buf = Buffer.alloc(1);
    let n = fs.readSync(fd, buf, 0, 1, null);
    while (n > 0 && buf[0] !== 0x0a) {
      chunks.push(Buffer.from([buf[0]]));
      n = fs.readSync(fd, buf, 0, 1, null);
    }

    fs.writeSync(fd, '\n');
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    try {
      execSync('stty echo', { stdio: [fd, 'inherit', 'inherit'] });
    } catch {
      // ignore restore failure
    }
    fs.closeSync(fd);
  }
}
