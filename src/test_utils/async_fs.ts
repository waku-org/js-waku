import fs, { promises as asyncFs } from 'fs';
import { promisify } from 'util';

import { delay } from './delay';
export const existsAsync = (filepath: string) =>
  asyncFs.access(filepath, fs.constants.F_OK);

export const openAsync = promisify(fs.open);

export const mkdirAsync = asyncFs.mkdir;

export async function waitForFile(path: string) {
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
