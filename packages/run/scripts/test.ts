#!/usr/bin/env node

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { Protocols } from "@waku/sdk";

import { WakuTestClient } from "../src/test-client.js";
import { getProjectName } from "../src/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = __dirname.includes("dist")
  ? join(__dirname, "..", "..")
  : join(__dirname, "..");

interface Colors {
  reset: string;
  cyan: string;
  green: string;
  red: string;
  yellow: string;
}

// ANSI color codes
const colors: Colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m"
};

async function main(): Promise<void> {
  let client: WakuTestClient | null = null;

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
      process.stderr.write(
        `${colors.red}✗${colors.reset} No nodes running. Start with: ${colors.cyan}npx @waku/run start${colors.reset}\n`
      );
      process.exit(1);
    }

    process.stdout.write(
      `${colors.cyan}Testing local Waku network...${colors.reset}\n\n`
    );

    // Step 1: Create client
    process.stdout.write(
      `${colors.cyan}→${colors.reset} Creating Waku light node...\n`
    );
    client = new WakuTestClient();

    // Step 2: Start and connect
    process.stdout.write(`${colors.cyan}→${colors.reset} Starting node...\n`);
    await client.start();

    // Step 3: Wait for peers
    process.stdout.write(
      `${colors.cyan}→${colors.reset} Waiting for peers...\n`
    );
    await client.waku!.waitForPeers([Protocols.LightPush]);
    const connectedPeers = client.waku!.libp2p.getPeers().length;
    process.stdout.write(
      `${colors.green}✓${colors.reset} Connected to ${connectedPeers} peer(s)\n`
    );

    // Step 4: Send test message
    process.stdout.write(
      `${colors.cyan}→${colors.reset} Sending lightpush message...\n`
    );
    const result = await client.sendTestMessage("Test from @waku/run");

    if (result.success) {
      process.stdout.write(
        `${colors.green}✓${colors.reset} Message sent successfully to ${result.messagesSent} peer(s)\n`
      );
      process.stdout.write(
        `\n${colors.green}✓ All tests passed!${colors.reset}\n`
      );
      process.stdout.write(
        `${colors.cyan}The local Waku network is working correctly.${colors.reset}\n`
      );
    } else {
      process.stderr.write(
        `${colors.red}✗${colors.reset} Failed to send message: ${result.error || "Unknown error"}\n`
      );
      process.stderr.write(
        `  Sent: ${result.messagesSent}, Failed: ${result.failures}\n`
      );
      process.exit(1);
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    process.stderr.write(
      `${colors.red}✗${colors.reset} Test failed: ${err.message || String(error)}\n`
    );
    process.exit(1);
  } finally {
    if (client) {
      await client.stop();
    }
  }
}

main().catch((error) => {
  process.stderr.write(`Unexpected error: ${String(error)}\n`);
  process.exit(1);
});
