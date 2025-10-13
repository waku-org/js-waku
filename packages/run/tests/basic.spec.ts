import { execSync } from "child_process";

import { Protocols } from "@waku/sdk";
import { expect } from "chai";

import { WakuTestClient } from "../src/test-client.js";

describe("Waku Run - Basic Test", function () {
  this.timeout(90000);

  let client: WakuTestClient;

  before(async function () {
    // Step 1: Start the nodes
    execSync("docker compose up -d", {
      stdio: "inherit"
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

    // Nodes automatically connect via --staticnode configuration
    // cspell:ignore staticnode
    // Wait for nwaku nodes to connect to each other
    let connected = false;
    for (let i = 0; i < 15; i++) {
      try {
        const peers = await fetch("http://127.0.0.1:8646/admin/v1/peers").then(
          (r) => r.json()
        );
        if (peers.length > 0 && peers[0].connected === "Connected") {
          connected = true;
          break;
        }
      } catch {
        // Ignore errors
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!connected) {
      throw new Error("Nwaku nodes failed to connect to each other");
    }
  });

  after(async function () {
    // Step 4: Stop the nodes
    if (client) {
      await client.stop();
    }
    execSync("docker compose down", {
      stdio: "inherit"
    });
  });

  it("should connect to both nodes and send lightpush message to both peers", async function () {
    // Step 2: Connect to nodes via js-waku using WakuTestClient
    client = new WakuTestClient({
      contentTopic: "/test/1/basic/proto"
    });

    await client.start();

    // Wait for both peers to be connected
    await client.waku!.waitForPeers([Protocols.LightPush]);
    const connectedPeers = client.waku!.libp2p.getPeers().length;
    expect(connectedPeers).to.equal(
      2,
      "Should be connected to both nwaku nodes"
    );

    // Step 3: Send lightpush message - it should be sent to both peers
    const result = await client.sendTestMessage("Hello Waku!");

    expect(result.success).to.be.true;
    expect(result.messagesSent).to.equal(
      2,
      "Message should be sent to both peers"
    );
    expect(result.failures).to.equal(0, "Should have no failures");
  });
});
