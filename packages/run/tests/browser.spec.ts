import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { Browser, chromium, expect, Page, test } from "@playwright/test";

import { NODE1_PEER_ID, NODE2_PEER_ID } from "../src/constants.js";
import { getProjectName } from "../src/utils.js";

import { startTestServer, stopTestServer } from "./test-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");

test.describe.configure({ mode: "serial" });

test.describe("Waku Run - Browser Test", () => {
  let browser: Browser;
  let page: Page;
  const testPort = 8080;
  const baseUrl = `http://localhost:${testPort}`;

  test.beforeAll(async () => {
    // Start test HTTP server
    await startTestServer(testPort);

    // Start docker compose
    const projectName = getProjectName(packageRoot);
    execSync(`docker compose --project-name ${projectName} up -d`, {
      stdio: "inherit",
      cwd: packageRoot,
      env: { ...process.env, COMPOSE_PROJECT_NAME: projectName }
    });

    // Wait for nodes to be ready
    const maxRetries = 30;
    const retryDelay = 2000;
    let ready = false;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await fetch("http://127.0.0.1:8646/debug/v1/info");
        await fetch("http://127.0.0.1:8647/debug/v1/info");
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    if (!ready) {
      throw new Error("Nodes failed to start within expected time");
    }

    // Wait for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    page = await browser.newPage();

    // Forward browser console to test logs
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[Browser Console ${type.toUpperCase()}] ${text}`);
    });

    page.on("pageerror", (error) => {
      console.error("[Browser Page Error]", error.message);
    });

    await page.goto(`${baseUrl}/index.html`, {
      // cspell:ignore networkidle - Playwright waitUntil option
      waitUntil: "networkidle"
    });

    await page.waitForFunction(
      () => {
        return (
          (window as any).wakuBrowser &&
          typeof (window as any).wakuBrowser.createAndStartNode === "function"
        );
      },
      { timeout: 10000 }
    );
  });

  test.afterAll(async () => {
    if (page) {
      try {
        await page.evaluate(() => (window as any).wakuBrowser.stop());
      } catch {
        // Ignore errors
      }
    }

    if (browser) {
      await browser.close();
    }

    const projectName = getProjectName(packageRoot);
    execSync(`docker compose --project-name ${projectName} down`, {
      stdio: "inherit",
      cwd: packageRoot,
      env: { ...process.env, COMPOSE_PROJECT_NAME: projectName }
    });

    await stopTestServer();
  });

  test("should initialize Waku node in browser", async () => {
    test.setTimeout(120000);

    const node1Port = process.env.NODE1_WS_PORT || "60000";
    const node2Port = process.env.NODE2_WS_PORT || "60001";

    // Static peer IDs from --nodekey configuration
    // cspell:ignore nodekey
    const peer1 = NODE1_PEER_ID;
    const peer2 = NODE2_PEER_ID;

    const config = {
      bootstrapPeers: [
        `/ip4/127.0.0.1/tcp/${node1Port}/ws/p2p/${peer1}`,
        `/ip4/127.0.0.1/tcp/${node2Port}/ws/p2p/${peer2}`
      ],
      networkConfig: {
        clusterId: 0,
        numShardsInCluster: 8
      }
    };

    // Create and start waku node in browser
    console.log("Creating Waku node in browser with config:", config);

    const createResult = await page.evaluate(async (cfg) => {
      try {
        console.log("Browser: Starting node creation...");
        const result = await (window as any).wakuBrowser.createAndStartNode(
          cfg
        );
        console.log("Browser: Node created successfully");
        return { success: true, result };
      } catch (error: any) {
        console.error("Browser: Error creating node:", error);
        return { success: false, error: error.message || String(error) };
      }
    }, config);

    console.log("Create result:", createResult);
    expect(createResult.success).toBe(true);

    // Verify the node was created and has the expected properties
    const nodeInfo = await page.evaluate(() => {
      const waku = (window as any).wakuBrowser.waku;
      if (!waku) {
        return { created: false };
      }
      return {
        created: true,
        hasLightPush: !!waku.lightPush,
        peerId: waku.libp2p.peerId.toString()
      };
    });

    console.log("Node info:", nodeInfo);
    expect(nodeInfo.created).toBe(true);
    expect(nodeInfo.hasLightPush).toBe(true);
    expect(nodeInfo.peerId).toBeDefined();
  });
});
