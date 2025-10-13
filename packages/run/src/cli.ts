#!/usr/bin/env node

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const command = process.argv[2];

const scriptMap: Record<string, string> = {
  start: join(__dirname, "..", "scripts", "start.js"),
  stop: join(__dirname, "..", "scripts", "stop.js"),
  info: join(__dirname, "..", "scripts", "info.js"),
  logs: join(__dirname, "..", "scripts", "logs.js"),
  test: join(__dirname, "..", "scripts", "test.js")
};

if (!command || !scriptMap[command]) {
  process.stderr.write("Usage: @waku/run <command>\n");
  process.stderr.write("\n");
  process.stderr.write("Commands:\n");
  process.stderr.write("  start    Start the local Waku network\n");
  process.stderr.write("  stop     Stop the local Waku network\n");
  process.stderr.write("  info     Show connection info for running network\n");
  process.stderr.write("  logs     View logs from running network\n");
  process.stderr.write("  test     Test the network by sending a message\n");
  process.exit(1);
}

const scriptPath = scriptMap[command];
const child = spawn("node", [scriptPath], {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
