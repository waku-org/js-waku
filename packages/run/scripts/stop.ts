#!/usr/bin/env node

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In development: scripts are in packages/run/scripts
// In published package: scripts are in node_modules/@waku/run/dist/scripts
const packageRoot = __dirname.includes("dist")
  ? join(__dirname, "..", "..")
  : join(__dirname, "..");

try {
  execSync("docker compose down", {
    cwd: packageRoot,
    stdio: "inherit"
  });
} catch (error: unknown) {
  const err = error as { message?: string };
  process.stderr.write(
    `Error stopping network: ${err.message || String(error)}\n`
  );
  process.exit(1);
}
