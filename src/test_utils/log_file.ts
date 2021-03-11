import fs, { promises as asyncFs } from 'fs';

import pTimeout from 'p-timeout';
import { Tail } from 'tail';

import { delay } from './delay';

const existsAsync = (filepath: string) =>
  asyncFs.access(filepath, fs.constants.F_OK);

async function waitForFile(path: string) {
  let found = false;
  do {
    try {
      await existsAsync(path);
      found = true;
    } catch (e) {
      await delay(500);
    }
  } while (!found);
}

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
