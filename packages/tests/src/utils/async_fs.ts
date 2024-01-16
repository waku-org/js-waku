/**
 * Various promisify of fs utilities.
 *
 * @hidden
 * @module
 */

import fs, { promises as asyncFs } from "fs";
import { promisify } from "util";

import { delay } from "./delay.js";

export const existsAsync = (filepath: string): Promise<void> =>
  asyncFs.access(filepath, fs.constants.F_OK);

export const openAsync = promisify(fs.open);

export const mkdirAsync = asyncFs.mkdir;

export async function waitForFile(path: string): Promise<void> {
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

export * from "./log_file.js";
