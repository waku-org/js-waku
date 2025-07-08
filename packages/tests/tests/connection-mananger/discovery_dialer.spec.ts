import { LightNode } from "@waku/interfaces";
import { expect } from "chai";
import type { Context } from "mocha";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import { TestShardInfo } from "./utils.js";

describe("DiscoveryDialer", function () {
  const ctx: Context = this.ctx;
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true, peerExchange: true },
      false,
      2,
      true
    );

    await teardownNodesWithRedundancy(serviceNodes, []);

    serviceNodes = await ServiceNodesFleet.createAndRun(
      ctx,
      2,
      false,
      TestShardInfo,
      {
        lightpush: true,
        filter: true,
        peerExchange: true
      },
      false
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("should dial second nwaku node that was discovered", async function () {
    console.log(
      "[DEBUG] Starting test: should dial second nwaku node that was discovered"
    );

    const maddrs = await Promise.all(
      serviceNodes.nodes.map((n, idx) => {
        return n.getMultiaddrWithId().then((addr) => {
          console.log(
            `[DEBUG] serviceNodes.nodes[${idx}] multiaddr:`,
            addr.toString ? addr.toString() : addr
          );
          return addr;
        });
      })
    );

    console.log("[DEBUG] Multiaddrs collected:", maddrs);

    const isConnectedInitially = waku.isConnected();
    console.log(
      "[DEBUG] waku.isConnected() before dial:",
      isConnectedInitially,
      waku.libp2p.getConnections().length
    );
    expect(isConnectedInitially, "waku is connected").to.be.false;

    const connectedPeersInitially = await waku.getConnectedPeers();
    console.log(
      "[DEBUG] waku.getConnectedPeers() before dial:",
      connectedPeersInitially
    );
    expect(
      connectedPeersInitially,
      "waku has no connected peers"
    ).to.have.length(0);

    const connectPromise = new Promise((resolve, reject) => {
      waku.libp2p.addEventListener("peer:connect", () => {
        console.log("[DEBUG] peer:connect event fired");
        resolve(true);
      });

      setTimeout(() => {
        console.log("[DEBUG] Timeout waiting for peer:connect event");
        reject(new Error("Timeout waiting for peer:connect event"));
      }, 1000);
    });

    try {
      console.log("[DEBUG] Dialing first node at:", maddrs[0]);
      const s = await waku.dial(maddrs[0]);
      console.log("[DEBUG] Dial to first node completed", s);
    } catch (error) {
      console.log("[DEBUG] Error during waku.dial:", error);
      throw Error(error as string);
    }

    await connectPromise;
    console.log(
      "[DEBUG] connectPromise resolved",
      waku.libp2p.getConnections().length
    );

    const isConnectedAfterDial = waku.isConnected();
    console.log(
      "[DEBUG] waku.isConnected() after dial:",
      isConnectedAfterDial,
      waku.libp2p.getConnections().length
    );
    expect(isConnectedAfterDial, "waku is connected").to.be.true;

    const connectedPeersAfterDial = await waku.getConnectedPeers();
    console.log(
      "[DEBUG] waku.getConnectedPeers() after dial:",
      connectedPeersAfterDial
    );
    expect(
      connectedPeersAfterDial,
      "waku has one connected peer"
    ).to.have.length(1);

    const secondPeerId = await serviceNodes.nodes[1].getPeerId();
    console.log(
      "[DEBUG] secondPeerId:",
      secondPeerId.toString ? secondPeerId.toString() : secondPeerId
    );

    const discoveryPromise = new Promise((resolve) => {
      waku.libp2p.addEventListener("peer:discovery", (event) => {
        console.log(
          "[DEBUG] peer:discovery event fired with detail:",
          event.detail
        );
        if (event.detail.id.equals(secondPeerId)) {
          console.log(
            "[DEBUG] Discovered second peer:",
            secondPeerId.toString ? secondPeerId.toString() : secondPeerId
          );
          resolve(true);
        }
      });
    });

    // TODO(weboko): investigate why peer-exchange discovery is not working https://github.com/waku-org/js-waku/issues/2446
    console.log(
      "[DEBUG] Saving secondPeerId to peerStore with multiaddr:",
      maddrs[1]
    );
    await waku.libp2p.peerStore.save(secondPeerId, {
      multiaddrs: [maddrs[1]]
    });

    await discoveryPromise;
    console.log("[DEBUG] discoveryPromise resolved");
    await delay(500);

    const connections = waku.libp2p.getConnections();
    console.log("[DEBUG] waku.libp2p.getConnections() at end:", connections);

    expect(connections, "waku has two connections").to.have.length(2);
  });
});
