#!/usr/bin/env node

import { execSync } from "child_process";

interface Colors {
  reset: string;
  cyan: string;
  blue: string;
  gray: string;
  yellow: string;
}

interface NodeInfo {
  listenAddresses: string[];
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
  const output: string = execSync("docker compose ps --quiet", {
    encoding: "utf-8"
  }).trim();

  if (!output) {
    process.stdout.write(
      `${colors.gray}No nodes running. Start with: ${colors.cyan}npm run start${colors.reset}\n`
    );
    process.exit(0);
  }

  // Get cluster config from env or defaults
  const clusterId: string = process.env.CLUSTER_ID || "0";
  const node1Port: string = process.env.NODE1_WS_PORT || "60000";
  const node2Port: string = process.env.NODE2_WS_PORT || "60001";

  // Fetch node info
  const node1Info: NodeInfo = await fetch(
    "http://127.0.0.1:8646/debug/v1/info"
  ).then((r) => r.json());
  const node2Info: NodeInfo = await fetch(
    "http://127.0.0.1:8647/debug/v1/info"
  ).then((r) => r.json());

  const peer1: string = node1Info.listenAddresses[0].split("/p2p/")[1];
  const peer2: string = node2Info.listenAddresses[0].split("/p2p/")[1];

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
