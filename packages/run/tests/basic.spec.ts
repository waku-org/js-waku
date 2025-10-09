import { execSync } from "child_process";

import { createEncoder } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { createLightNode, Protocols, waitForRemotePeer } from "@waku/sdk";
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

    // Connect the two nwaku nodes together
    const node1Info = await fetch("http://127.0.0.1:8646/debug/v1/info").then(
      (r) => r.json()
    );
    const peer1Multiaddr = node1Info.listenAddresses[0];

    await fetch("http://127.0.0.1:8647/admin/v1/peers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([peer1Multiaddr])
    });

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

  it("should connect to nodes and send lightpush message", async function () {
    // Step 2: Connect to nodes via js-waku
    const node1Port = process.env.NODE1_WS_PORT || "60000";
    const node2Port = process.env.NODE2_WS_PORT || "60001";

    // Fetch node info to get peer IDs
    const node1Info = await fetch("http://127.0.0.1:8646/debug/v1/info").then(
      (r) => r.json()
    );
    const node2Info = await fetch("http://127.0.0.1:8647/debug/v1/info").then(
      (r) => r.json()
    );

    const peer1 = node1Info.listenAddresses[0].split("/p2p/")[1];
    const peer2 = node2Info.listenAddresses[0].split("/p2p/")[1];

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
      networkConfig
    });

    await waku.start();
    await waku.waitForPeers([Protocols.LightPush]);

    // Step 3: Send a lightpush message
    const contentTopic = "/test/1/basic/proto";
    const routingInfo = createRoutingInfo(networkConfig, { contentTopic });
    const encoder = createEncoder({ contentTopic, routingInfo });

    const result = await waku.lightPush.send(encoder, {
      payload: new TextEncoder().encode("Hello Waku!")
    });

    expect(result.successes.length).to.be.greaterThan(0);
  });
});
