#!/usr/bin/env node

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { getProjectName } from "../src/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In development: scripts are in packages/run/scripts
// In published package: scripts are in node_modules/@waku/run/dist/scripts
const packageRoot = __dirname.includes("dist")
  ? join(__dirname, "..", "..")
  : join(__dirname, "..");

try {
  const projectName = getProjectName(packageRoot);
  execSync(`docker compose --project-name ${projectName} down`, {
    cwd: packageRoot,
    stdio: "inherit",
    env: { ...process.env, COMPOSE_PROJECT_NAME: projectName }
  });
} catch (error: unknown) {
  const err = error as { message?: string };
  process.stderr.write(
    `Error stopping network: ${err.message || String(error)}\n`
  );
  process.exit(1);
}
