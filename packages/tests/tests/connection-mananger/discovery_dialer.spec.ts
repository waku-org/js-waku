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

    // TODO(weboko): investigate why peer-exchange discovery is not working https://github.com/waku-org/js-waku/issues/2446
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
});
