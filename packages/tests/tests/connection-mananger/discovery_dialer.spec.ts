import { LightNode, Protocols } from "@waku/interfaces";
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

describe.only("DiscoveryDialer", function () {
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
    const maddrs = await Promise.all(
      serviceNodes.nodes.map((n) => n.getMultiaddrWithId())
    );

    expect(waku.isConnected(), "waku is connected").to.be.false;
    expect(
      await waku.getConnectedPeers(),
      "waku has no connected peers"
    ).to.have.length(0);

    try {
      await waku.dial(maddrs[0], [Protocols.Filter, Protocols.LightPush]);
    } catch (error) {
      throw Error(error as string);
    }

    expect(waku.isConnected(), "waku is connected").to.be.true;
    expect(
      await waku.getConnectedPeers(),
      "waku has one connected peer"
    ).to.have.length(1);

    const secondPeerId = await serviceNodes.nodes[1].getPeerId();
    const promise = new Promise((resolve) => {
      waku.libp2p.addEventListener("peer:discovery", (event) => {
        if (event.detail.id.equals(secondPeerId)) {
          resolve(true);
        }
      });
    });

    // TODO(weboko): investigate why peer-exchange discovery is not working
    await waku.libp2p.peerStore.save(secondPeerId, {
      multiaddrs: [maddrs[1]]
    });

    await promise;
    await delay(500);

    expect(
      waku.libp2p.getConnections(),
      "waku has two connections"
    ).to.have.length(2);
  });

  // it("should handle peer exchange gracefully when second node is unavailable", async function () {
  //   console.log("=== Testing error handling ===");

  //   // Stop nwaku2 to simulate unavailable peer
  //   await nwaku2.stop();

  //   console.log("Attempting to connect to nwaku1...");
  //   try {
  //     await waku.dial(nwaku1Multiaddr, [Protocols.Filter]);
  //     await delay(3000);
  //   } catch (error) {
  //     console.log("Connection failed, but testing DiscoveryDialer anyway...");
  //   }

  //   // Reset dial spy
  //   dialSpy.resetHistory();

  //   // Test DiscoveryDialer with unavailable peer
  //   console.log("Simulating discovery of unavailable peer...");
  //   waku.libp2p.dispatchEvent(
  //     new CustomEvent("peer:discovery", {
  //       detail: {
  //         id: nwaku2Multiaddr.getPeerId(),
  //         multiaddrs: [nwaku2Multiaddr]
  //       }
  //     })
  //   );

  //   await delay(3000);

  //   // DiscoveryDialer should attempt to dial even if it fails
  //   console.log(
  //     `DiscoveryDialer dial attempts to unavailable peer: ${dialSpy.callCount}`
  //   );

  //   // This test primarily verifies DiscoveryDialer attempts to dial discovered peers
  //   // even when they're unavailable (graceful error handling)
  //   console.log(
  //     "✓ Error handling test completed - DiscoveryDialer handles unavailable peers gracefully"
  //   );
  // });
});
