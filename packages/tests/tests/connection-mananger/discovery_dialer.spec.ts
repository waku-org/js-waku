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
  let navigatorMock: any;
  let originalNavigator: any;

  beforeEachCustom(this, async () => {
    originalNavigator = global.navigator;
    navigatorMock = { onLine: true };
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorMock,
      configurable: true,
      writable: false
    });

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
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: false
    });

    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("should dial second nwaku node that was discovered", async function () {
    console.log(
      "[DEBUG] Starting test: should dial second nwaku node that was discovered"
    );

    const maddrs = await Promise.all(
      serviceNodes.nodes.map((n) => n.getMultiaddrWithId())
    );

    expect(waku.isConnected(), "waku is connected").to.be.false;
    expect(
      await waku.getConnectedPeers(),
      "waku has no connected peers"
    ).to.have.length(0);

    const connectPromise = new Promise((resolve, reject) => {
      waku.libp2p.addEventListener("peer:connect", () => {
        resolve(true);
      });

      setTimeout(() => {
        reject(new Error("Timeout waiting for peer:connect event"));
      }, 1000);
    });

    try {
      await waku.dial(maddrs[0]);
      console.log(
        "[DEBUG] Dial to first node completed",
        waku.isConnected(),
        waku.libp2p.getConnections().length
      );
    } catch (error) {
      throw Error(error as string);
    }

    await connectPromise;

    console.log(
      "[DEBUG] connectPromise resolved",
      waku.isConnected(),
      waku.libp2p.getConnections().length,
      waku.libp2p.getConnections().length
    );

    expect(waku.isConnected(), "waku is connected").to.be.true;
    console.log(
      "[DEBUG] expect(waku.isConnected(), 'waku is connected').to.be.true",
      waku.isConnected(),
      waku.libp2p.getConnections().length
    );

    expect(
      await waku.getConnectedPeers(),
      "waku has one connected peer"
    ).to.have.length(1);

    const secondPeerId = await serviceNodes.nodes[1].getPeerId();
    const discoveryPromise = new Promise((resolve) => {
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

    await discoveryPromise;
    await delay(500);

    expect(
      waku.libp2p.getConnections(),
      "waku has two connections"
    ).to.have.length(2);
  });
});
