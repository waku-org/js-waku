import pTimeout from 'p-timeout';
import { Tail } from 'tail';

import { waitForFile } from './async_fs';

export default async function waitForLine(filepath: string, logLine: string) {
  await pTimeout(waitForFile(filepath), 2000);

  const options = {
    fromBeginning: true,
    follow: true,
  };

  const tail = new Tail(filepath, options);

  await pTimeout(
    find(tail, logLine),
    60000,
    `could not to find '${logLine}' in file '${filepath}'`
  );
  tail.unwatch();
}

async function find(tail: Tail, line: string) {
  return new Promise((resolve, reject) => {
    tail.on('line', (data: string) => {
      if (data.includes(line)) {
        resolve(data);
      }
    });

    tail.on('error', (err) => {
      reject(err);
    });
  });
}
