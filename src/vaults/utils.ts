import * as os from 'os';

export const replaceWithAstrisk = (str: string | undefined) => {
  if (str) {
    return [...str]
      .map((e, i) => {
        if (i > 0 && i < str.length - 4) {
          return '*';
        }

        return e;
      })
      .join('');
  }
};

export const objectToExport = (obj: Record<string, any>) => {
  return Object.entries(obj).reduce(
    (env, [OutputKey, OutputValue]) =>
      `${env}export ${OutputKey}=${OutputValue}${os.EOL}`,
    ''
  );
};

export const objectToEnv = (obj: Record<string, any>) => {
  return Object.entries(obj).map(
    ([OutputKey, OutputValue]) => (process.env[OutputKey] = OutputValue)
  );
};
