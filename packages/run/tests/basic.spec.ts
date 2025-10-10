import { execSync } from "child_process";

import { createEncoder } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { createLightNode, Protocols } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";

describe("Waku Run - Basic Test", function () {
  this.timeout(90000);

  let waku: LightNode;

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
    // Wait a bit for the connection to establish
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  after(async function () {
    // Step 4: Stop the nodes
    if (waku) {
      await waku.stop();
    }
    execSync("docker compose down", {
      stdio: "inherit"
    });
  });

  it("should connect to both nodes and send lightpush message to both peers", async function () {
    // Step 2: Connect to nodes via js-waku
    const node1Port = process.env.NODE1_WS_PORT || "60000";
    const node2Port = process.env.NODE2_WS_PORT || "60001";

    // Static peer IDs from --nodekey configuration
    // cspell:ignore nodekey
    const peer1 = "16Uiu2HAmF6oAsd23RMAnZb3NJgxXrExxBTPMdEoih232iAZkviU2";
    const peer2 = "16Uiu2HAm5aZU47YkiUoARqivbCXwuFPzFFXXiURAorySqAQbL6EQ";

    const networkConfig = {
      clusterId: 0,
      numShardsInCluster: 8
    };

    waku = await createLightNode({
      defaultBootstrap: false,
      bootstrapPeers: [
        `/ip4/127.0.0.1/tcp/${node1Port}/ws/p2p/${peer1}`,
        `/ip4/127.0.0.1/tcp/${node2Port}/ws/p2p/${peer2}`
      ],
      networkConfig,
      numPeersToUse: 2, // Use both peers for sending
      libp2p: {
        filterMultiaddrs: false
      }
    });

    await waku.start();

    // Wait for both peers to be connected
    await waku.waitForPeers([Protocols.LightPush]);

    // Verify we're connected to both peers
    const connectedPeers = waku.libp2p.getPeers();
    expect(connectedPeers.length).to.equal(
      2,
      "Should be connected to both nwaku nodes"
    );

    // Step 3: Send lightpush message - it should be sent to both peers
    const contentTopic = "/test/1/basic/proto";
    const routingInfo = createRoutingInfo(networkConfig, { contentTopic });
    const encoder = createEncoder({ contentTopic, routingInfo });

    const result = await waku.lightPush.send(encoder, {
      payload: new TextEncoder().encode("Hello Waku!")
    });

    // With numPeersToUse=2, the message should be sent to both peers
    expect(result.successes.length).to.equal(
      2,
      "Message should be sent to both peers"
    );
    expect(result.failures?.length || 0).to.equal(0, "Should have no failures");
  });
});
