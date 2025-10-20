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
import { getProjectName } from "../src/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = __dirname.includes("dist")
  ? join(__dirname, "..", "..")
  : join(__dirname, "..");

interface Colors {
  reset: string;
  cyan: string;
  blue: string;
  gray: string;
  yellow: string;
}

// ANSI color codes
const colors: Colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  yellow: "\x1b[33m"
};

try {
  // Check if containers are running
  const projectName = getProjectName(packageRoot);
  const output: string = execSync(
    `docker compose --project-name ${projectName} ps --quiet`,
    {
      cwd: packageRoot,
      encoding: "utf-8",
      env: { ...process.env, COMPOSE_PROJECT_NAME: projectName }
    }
  ).trim();

  if (!output) {
    process.stdout.write(
      `${colors.gray}No nodes running. Start with: ${colors.cyan}npm run start${colors.reset}\n`
    );
    process.exit(0);
  }

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
    `${colors.blue}import${colors.reset} { createLightNode } ${colors.blue}from${colors.reset} ${colors.yellow}"@waku/sdk"${colors.reset};\n`
  );
  process.stdout.write(`\n`);
  process.stdout.write(
    `${colors.blue}const${colors.reset} waku = ${colors.blue}await${colors.reset} createLightNode({\n`
  );
  process.stdout.write(
    `  defaultBootstrap: ${colors.cyan}false${colors.reset},\n`
  );
  process.stdout.write(`  bootstrapPeers: [\n`);
  process.stdout.write(
    `    ${colors.yellow}"/ip4/127.0.0.1/tcp/${node1Port}/ws/p2p/${peer1}"${colors.reset},\n`
  );
  process.stdout.write(
    `    ${colors.yellow}"/ip4/127.0.0.1/tcp/${node2Port}/ws/p2p/${peer2}"${colors.reset}\n`
  );
  process.stdout.write(`  ],\n`);
  process.stdout.write(`  numPeersToUse: ${colors.cyan}2${colors.reset},\n`);
  process.stdout.write(`  libp2p: {\n`);
  process.stdout.write(
    `    filterMultiaddrs: ${colors.cyan}false${colors.reset}\n`
  );
  process.stdout.write(`  },\n`);
  process.stdout.write(`  networkConfig: {\n`);
  process.stdout.write(
    `    clusterId: ${colors.cyan}${clusterId}${colors.reset},\n`
  );
  process.stdout.write(
    `    numShardsInCluster: ${colors.cyan}8${colors.reset}\n`
  );
  process.stdout.write(`  }\n`);
  process.stdout.write(`});\n`);
} catch (error: unknown) {
  const err = error as { cause?: { code?: string }; message?: string };
  if (err.cause?.code === "ECONNREFUSED") {
    process.stderr.write(
      `${colors.yellow}⚠${colors.reset}  Nodes are still starting. Try again in a few seconds.\n`
    );
    process.exit(1);
  } else {
    process.stderr.write(
      `${colors.yellow}✗${colors.reset} Error: ${err.message || String(error)}\n`
    );
    process.exit(1);
  }
}
