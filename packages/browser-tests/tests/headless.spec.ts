import { expect, test } from "@playwright/test";
import { LightNode } from "@waku/sdk";

import { API } from "../src/api/shared.js";

// Define the window interface for TypeScript
declare global {
  interface Window {
    waku: LightNode;
    wakuAPI: typeof API;
  }
}

// Cluster 42
const peers = [
  "/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ",
  "/dns4/waku.fryorcraken.xyz/tcp/8000/wss/p2p/16Uiu2HAmMRvhDHrtiHft1FTUYnn6cVA8AWVrTyLUayJJ3MWpUZDB",
  "/dns4/ivansete.xyz/tcp/8000/wss/p2p/16Uiu2HAmDAHuJ8w9zgxVnhtFe8otWNJdCewPAerJJPbXJcn8tu4r"
];
// Waku sandbox
// const peers = [
//   "/dns4/node-01.do-ams3.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmNaeL4p3WEYzC9mgXBmBWSgWjPHRvatZTXnp8Jgv3iKsb",
//   "/dns4/node-01.gc-us-central1-a.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmRv1iQ3NoMMcjbtRmKxPuYBbF9nLYz2SDv9MTN8WhGuUU",
//   "/dns4/node-01.ac-cn-hongkong-c.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmQYiojgZ8APsh9wqbWNyCstVhnp9gbeNrxSEQnLJchC92"
// ];

test.describe("waku", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("");
    await page.waitForTimeout(5000);

    // Create and initialize a fresh Waku node for each test
    const setupResult = await page.evaluate(async () => {
      try {
        await window.wakuAPI.createWakuNode({
          defaultBootstrap: false,
          networkConfig: {
            clusterId: 42,
            shards: [0]
          }
        });
        await window.wakuAPI.startNode();
        return { success: true };
      } catch (error) {
        console.error("Failed to initialize Waku node:", error);
        return { success: false, error: String(error) };
      }
    });

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

  test("can dial peers", async ({ page }) => {
    const result = await page.evaluate((peerAddrs) => {
      return window.wakuAPI.dialPeers(window.waku, peerAddrs);
    }, peers);

    expect(result).toBeDefined();
    expect(result.total).toBe(peers.length);
    expect(result.errors.length >= result.total).toBe(false);
    console.log("Dial result:", result);
  });

  test("can push a message", async ({ page }) => {
    // First dial to peers
    await page.evaluate((peersToDial) => {
      return window.wakuAPI.dialPeers(window.waku, peersToDial);
    }, peers);

    // Create a test message
    const contentTopic = "/test/1/message/proto";
    const payload = new TextEncoder().encode("Hello, Waku!");
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
