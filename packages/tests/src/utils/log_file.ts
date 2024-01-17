/**
 * Utilities to make it help check nwaku logs.
 *
 * @hidden
 * @module
 */

import { Context } from "mocha";
import pTimeout from "p-timeout";
import { Tail } from "tail";

import { waitForFile } from "./async_fs.js";

export default async function waitForLine(
  filepath: string,
  logLine: string,
  timeout: number
): Promise<void> {
  await pTimeout(waitForFile(filepath), { milliseconds: timeout });

  const options = {
    fromBeginning: true,
    follow: true
  };

  const tail = new Tail(filepath, options);

  await pTimeout(find(tail, logLine), {
    milliseconds: 60000,
    message: `could not to find '${logLine}' in file '${filepath}'`
  });
  tail.unwatch();
}

async function find(tail: Tail, line: string): Promise<string> {
  return new Promise((resolve, reject) => {
    tail.on("line", (data: string) => {
      if (data.includes(line)) {
        resolve(data);
      }
    });

    tail.on("error", (err) => {
      reject(err);
    });
  });
}

function clean(str: string): string {
  return str.replace(/ /g, "_").replace(/[':()/]/g, "");
}

export function makeLogFileName(ctx: Context): string {
  const unitTest = ctx?.currentTest ? ctx!.currentTest : ctx.test;
  let name = clean(unitTest!.title);
  let suite = unitTest?.parent;

  while (suite && suite.title) {
    name = clean(suite.title) + "_" + name;
    suite = suite.parent;
  }
  return name;
}
