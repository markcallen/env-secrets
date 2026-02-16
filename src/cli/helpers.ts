export type OutputFormat = 'json' | 'table';

export const asOutputFormat = (value: string): OutputFormat => {
  if (value !== 'json' && value !== 'table') {
    throw new Error(`Invalid output format "${value}". Use "json" or "table".`);
  }

  return value;
};

export const renderTable = (
  headers: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string | undefined>>
) => {
  if (rows.length === 0) {
    return 'No results.';
  }

  const widths = headers.map((header) => {
    return Math.max(
      header.label.length,
      ...rows.map((row) => String(row[header.key] || '').length)
    );
  });

  const headerLine = headers
    .map((header, index) => header.label.padEnd(widths[index]))
    .join('  ');
  const divider = headers
    .map((_, index) => '-'.repeat(widths[index]))
    .join('  ');
  const lines = rows.map((row) =>
    headers
      .map((header, index) =>
        String(row[header.key] || '').padEnd(widths[index])
      )
      .join('  ')
  );

  return [headerLine, divider, ...lines].join('\n');
};

export const printData = (
  format: OutputFormat,
  headers: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string | undefined>>
) => {
  if (format === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  // eslint-disable-next-line no-console
  console.log(renderTable(headers, rows));
};

export const parseRecoveryDays = (value: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 7 || parsed > 30) {
    throw new Error('Recovery days must be an integer between 7 and 30.');
  }

  return parsed;
};

export const readStdin = async (stdin: NodeJS.ReadStream = process.stdin) => {
  const chunks: Buffer[] = [];

  return await new Promise<string>((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      resolve(
        Buffer.concat(chunks)
          .toString('utf8')
          .replace(/\r?\n$/, '')
      );
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.off('error', onError);
    };

    stdin.on('data', onData);
    stdin.once('end', onEnd);
    stdin.once('error', onError);
  });
};

export const resolveSecretValue = async (
  value?: string,
  valueStdin?: boolean
): Promise<string | undefined> => {
  if (value && valueStdin) {
    throw new Error('Use either --value or --value-stdin, not both.');
  }

  if (valueStdin) {
    if (process.stdin.isTTY) {
      throw new Error(
        'No stdin detected. Pipe a value when using --value-stdin.'
      );
    }
    return await readStdin();
  }

  return value;
};
