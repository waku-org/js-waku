import { expect, test } from "@playwright/test";
import { LightNode } from "@waku/sdk";

import { API } from "../src/api/shared.js";
import { NETWORK_CONFIG, ACTIVE_PEERS } from "./test-config.js";

// Define the window interface for TypeScript
declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    waku: LightNode;
    wakuAPI: typeof API;
  }
}

test.describe("waku", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("");
    await page.waitForTimeout(5000);

    // Create and initialize a fresh Waku node for each test
    const setupResult = await page.evaluate(async (config) => {
      try {
        await window.wakuAPI.createWakuNode({
          ...config.defaultNodeConfig,
          networkConfig: config.networkConfig
        });
        await window.wakuAPI.startNode();
        return { success: true };
      } catch (error) {
        console.error("Failed to initialize Waku node:", error);
        return { success: false, error: String(error) };
      }
    }, NETWORK_CONFIG);

    expect(setupResult.success).toBe(true);
  });

  test("can get peer id", async ({ page }) => {
    const peerId = await page.evaluate(() => {
      return window.waku.libp2p.peerId.toString();
    });

    expect(peerId).toBeDefined();
    console.log("Peer ID:", peerId);
  });

  test("can get info", async ({ page }) => {
    const info = await page.evaluate(() => {
      return window.wakuAPI.getPeerInfo(window.waku);
    });

    expect(info).toBeDefined();
    expect(info.peerId).toBeDefined();
    expect(info.multiaddrs).toBeDefined();
    expect(info.peers).toBeDefined();
    console.log("Info:", info);
  });

  test("can get debug info", async ({ page }) => {
    const debug = await page.evaluate(() => {
      return window.wakuAPI.getDebugInfo(window.waku);
    });

    expect(debug).toBeDefined();
    expect(debug.listenAddresses).toBeDefined();
    expect(debug.peerId).toBeDefined();
    expect(debug.protocols).toBeDefined();
    console.log("Debug:", debug);
  });

  // TODO: https://github.com/waku-org/js-waku/issues/2619
  test.skip("can dial peers", async ({ page }) => {
    const result = await page.evaluate((peerAddrs) => {
      return window.wakuAPI.dialPeers(window.waku, peerAddrs);
    }, ACTIVE_PEERS);

    expect(result).toBeDefined();
    expect(result.total).toBe(ACTIVE_PEERS.length);
    expect(result.errors.length >= result.total).toBe(false);
    console.log("Dial result:", result);
  });

  test("can push a message", async ({ page }) => {
    // First dial to peers
    await page.evaluate((peersToDial) => {
      return window.wakuAPI.dialPeers(window.waku, peersToDial);
    }, ACTIVE_PEERS);

    // Create a test message
    const contentTopic = NETWORK_CONFIG.testMessage.contentTopic;
    const payload = new TextEncoder().encode(NETWORK_CONFIG.testMessage.payload);
    const arrayPayload = Array.from(payload);

    // Push the message
    const result = await page.evaluate(
      ({ topic, data }) => {
        return window.wakuAPI.pushMessage(
          window.waku,
          topic,
          new Uint8Array(data)
        );
      },
      { topic: contentTopic, data: arrayPayload }
    );

    expect(result).toBeDefined();
    console.log("Push result:", result);
  });

  test("can recreate Waku node", async ({ page }) => {
    // Get the current node's peer ID
    const initialPeerId = await page.evaluate(() => {
      return window.waku.libp2p.peerId.toString();
    });

    // Create a new node with different parameters
    const result = await page.evaluate(() => {
      return window.wakuAPI.createWakuNode({
        defaultBootstrap: true // Different from beforeEach
      });
    });

    expect(result.success).toBe(true);

    // Start the new node
    await page.evaluate(() => window.wakuAPI.startNode());

    // Get the new peer ID
    const newPeerId = await page.evaluate(() => {
      return window.waku.libp2p.peerId.toString();
    });

    expect(newPeerId).not.toBe(initialPeerId);
    console.log("Initial:", initialPeerId, "New:", newPeerId);
  });
});
