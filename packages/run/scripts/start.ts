#!/usr/bin/env node

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {
  DEFAULT_NODE1_WS_PORT,
  DEFAULT_NODE2_WS_PORT,
  NODE1_PEER_ID,
  NODE2_PEER_ID
} from "../src/constants.js";
import { getProjectName, printWakuConfig } from "../src/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = __dirname.includes("dist")
  ? join(__dirname, "..", "..")
  : join(__dirname, "..");

interface Colors {
  reset: string;
  cyan: string;
  green: string;
  blue: string;
  gray: string;
  yellow: string;
}

// ANSI color codes
const colors: Colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  yellow: "\x1b[33m"
};

function checkAndPullImages(): void {
  const nwakuImage = process.env.NWAKU_IMAGE || "wakuorg/nwaku:v0.36.0";
  const postgresImage = "postgres:15.4-alpine3.18";
  const images = [
    { name: nwakuImage, label: "nwaku" },
    { name: postgresImage, label: "postgres" }
  ];

  for (const { name, label } of images) {
    try {
      // Check if image exists locally
      const imageId = execSync(`docker images -q ${name}`, {
        encoding: "utf-8"
      }).trim();

      if (!imageId) {
        // Image doesn't exist, pull it
        process.stdout.write(
          `${colors.cyan}Pulling ${label} image (${name})...${colors.reset}\n`
        );
        execSync(`docker pull ${name}`, { stdio: "inherit" });
        process.stdout.write(
          `${colors.green}✓${colors.reset} ${label} image ready\n`
        );
      }
    } catch (error) {
      process.stderr.write(
        `${colors.yellow}⚠${colors.reset}  Failed to check/pull ${label} image. Continuing anyway...\n`
      );
    }
  }
}

async function waitWithProgress(ms: number): Promise<void> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const startTime = Date.now();
  let frameIndex = 0;

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= ms) {
        clearInterval(interval);
        process.stdout.write("\r" + " ".repeat(50) + "\r");
        resolve();
        return;
      }

      const frame = frames[frameIndex % frames.length];
      process.stdout.write(
        `\r${colors.cyan}${frame}${colors.reset} Waiting for nodes to start...`
      );
      frameIndex++;
    }, 100);
  });
}

process.stdout.write(
  `${colors.cyan}Starting local Waku development environment...${colors.reset}\n`
);

try {
  // Check and pull images if needed
  checkAndPullImages();

  // Start docker compose from package root
  const projectName = getProjectName(packageRoot);
  execSync(`docker compose --project-name ${projectName} up -d`, {
    cwd: packageRoot,
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf-8",
    env: { ...process.env, COMPOSE_PROJECT_NAME: projectName }
  });

  // Wait for nodes to be ready
  await waitWithProgress(20000);

  // Get cluster config from env or defaults
  const clusterId: string = process.env.CLUSTER_ID || "0";
  const node1Port: string = process.env.NODE1_WS_PORT || DEFAULT_NODE1_WS_PORT;
  const node2Port: string = process.env.NODE2_WS_PORT || DEFAULT_NODE2_WS_PORT;

  // Static peer IDs from --nodekey configuration
  // cspell:ignore nodekey
  const peer1: string = NODE1_PEER_ID;
  const peer2: string = NODE2_PEER_ID;

  // Print TypeScript-style config
  process.stdout.write(
    `${colors.green}✓${colors.reset} Network started successfully!\n\n`
  );
  process.stdout.write(
    `${colors.gray}Copy this into your application:${colors.reset}\n\n`
  );

  printWakuConfig(colors, node1Port, node2Port, peer1, peer2, clusterId);
  process.stdout.write(`\n`);
  process.stdout.write(`${colors.gray}Management:${colors.reset}\n`);

  // Detect if running via npx (published package) or npm run (development)
  const isPublished = __dirname.includes("dist");
  const cmdPrefix = isPublished ? "npx @waku/run" : "npm run";

  process.stdout.write(
    `  ${colors.cyan}${cmdPrefix} test${colors.reset}  - Test network with a message\n`
  );
  process.stdout.write(
    `  ${colors.cyan}${cmdPrefix} logs${colors.reset}  - View logs\n`
  );
  process.stdout.write(
    `  ${colors.cyan}${cmdPrefix} info${colors.reset}  - Show config again\n`
  );
  process.stdout.write(
    `  ${colors.cyan}${cmdPrefix} stop${colors.reset}  - Stop network\n`
  );
} catch (error: unknown) {
  const err = error as { cause?: { code?: string }; message?: string };
  if (err.cause?.code === "ECONNREFUSED") {
    process.stderr.write(
      `${colors.yellow}⚠${colors.reset}  Nodes are still starting up. Run ${colors.cyan}npm run info${colors.reset} in a few seconds.\n`
    );
  } else {
    process.stderr.write(
      `${colors.yellow}✗${colors.reset} Error: ${err.message || String(error)}\n`
    );
  }
  process.exit(1);
}
