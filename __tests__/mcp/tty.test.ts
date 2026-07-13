import * as fs from 'fs';
import { execSync } from 'child_process';

jest.mock('fs');
jest.mock('child_process');

const mockOpenSync = fs.openSync as jest.MockedFunction<typeof fs.openSync>;
const mockWriteSync = fs.writeSync as jest.MockedFunction<typeof fs.writeSync>;
const mockReadSync = fs.readSync as jest.MockedFunction<typeof fs.readSync>;
const mockCloseSync = fs.closeSync as jest.MockedFunction<typeof fs.closeSync>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

import { promptTty } from '../../src/mcp/tty';

describe('promptTty', () => {
  const FAKE_FD = 42;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenSync.mockReturnValue(FAKE_FD);
    mockWriteSync.mockReturnValue(0);
    mockCloseSync.mockReturnValue(undefined);
    mockExecSync.mockReturnValue(Buffer.from(''));
  });

  const encodeInput = (str: string): void => {
    let callIndex = 0;
    mockReadSync.mockImplementation(
      (_fd, buf: Buffer | NodeJS.ArrayBufferView) => {
        const buffer = buf as Buffer;
        if (callIndex < str.length) {
          buffer[0] = str.charCodeAt(callIndex++);
          return 1;
        }
        buffer[0] = 0x0a; // newline terminates
        return 1;
      }
    );
  };

  it('opens /dev/tty', async () => {
    encodeInput('secret');
    await promptTty('Enter value: ');
    expect(mockOpenSync).toHaveBeenCalledWith('/dev/tty', 'r+');
  });

  it('disables echo before reading', async () => {
    encodeInput('secret');
    await promptTty('Enter value: ');
    expect(mockExecSync).toHaveBeenCalledWith('stty -echo', expect.anything());
  });

  it('writes the prompt to the tty fd', async () => {
    encodeInput('secret');
    await promptTty('Enter value: ');
    expect(mockWriteSync).toHaveBeenCalledWith(FAKE_FD, 'Enter value: ');
  });

  it('returns the typed value without newline', async () => {
    encodeInput('mypassword');
    const result = await promptTty('Password: ');
    expect(result).toBe('mypassword');
  });

  it('restores echo after reading', async () => {
    encodeInput('value');
    await promptTty('Enter: ');
    expect(mockExecSync).toHaveBeenCalledWith('stty echo', expect.anything());
  });

  it('closes the fd in the finally block', async () => {
    encodeInput('value');
    await promptTty('Enter: ');
    expect(mockCloseSync).toHaveBeenCalledWith(FAKE_FD);
  });

  it('restores echo even when readSync throws', async () => {
    mockReadSync.mockImplementation(() => {
      throw new Error('read error');
    });
    await expect(promptTty('Enter: ')).rejects.toThrow('read error');
    expect(mockExecSync).toHaveBeenCalledWith('stty echo', expect.anything());
    expect(mockCloseSync).toHaveBeenCalledWith(FAKE_FD);
  });

  it('throws a clear error when /dev/tty is unavailable', async () => {
    mockOpenSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    await expect(promptTty('Enter: ')).rejects.toThrow(
      '/dev/tty is unavailable'
    );
  });

  it('handles empty input (immediate newline)', async () => {
    mockReadSync.mockImplementation(
      (_fd, buf: Buffer | NodeJS.ArrayBufferView) => {
        (buf as Buffer)[0] = 0x0a;
        return 1;
      }
    );
    const result = await promptTty('Enter: ');
    expect(result).toBe('');
  });
});
