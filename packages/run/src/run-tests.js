#!/usr/bin/env node

import { spawn } from "child_process";

const mochaArgs = [
  "mocha",
  "--require",
  "ts-node/register",
  "--project",
  "./tsconfig.json",
  ...process.argv.slice(2)
];

// Run mocha tests
const mocha = spawn("npx", mochaArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "test"
  }
});

mocha.on("error", (error) => {
  console.log(`Error running mocha tests: ${error.message}`); // eslint-disable-line no-console
  process.exit(1);
});

mocha.on("exit", (code) => {
  process.exit(code || 0);
});
