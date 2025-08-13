import { bootstrap } from "@libp2p/bootstrap";
import type { LightNode, PartialPeerInfo, PeerCache } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  DefaultTestClusterId,
  DefaultTestNetworkConfig,
  DefaultTestShardInfo,
  delay,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

class MockPeerCache implements PeerCache {
  public data: PartialPeerInfo[] = [];

  public get(): PartialPeerInfo[] {
    console.log("get", this.data);
    return this.data;
  }

  public set(value: PartialPeerInfo[]): void {
    console.log("set", value);
    this.data = value;
  }

  public remove(): void {
    this.data = [];
  }
}

describe.only("Local Peer Cache", function () {
  this.timeout(150_000);
  let ctx: Mocha.Context;
  let waku: LightNode;

  let nwaku1: ServiceNode;
  let nwaku2: ServiceNode;

  beforeEachCustom(this, async () => {
    ctx = this.ctx;
    nwaku1 = new ServiceNode(makeLogFileName(ctx) + "1");
    nwaku2 = new ServiceNode(makeLogFileName(ctx) + "2");
    await nwaku1.start({
      clusterId: DefaultTestClusterId,
      shard: DefaultTestShardInfo.shards,
      discv5Discovery: true,
      peerExchange: true,
      relay: true
    });
    await nwaku2.start({
      clusterId: DefaultTestClusterId,
      shard: DefaultTestShardInfo.shards,
      discv5Discovery: true,
      peerExchange: true,
      discv5BootstrapNode: (await nwaku1.info()).enrUri,
      relay: true
    });

    await delay(10_000); // wait for peer exchange to finish, nwaku takes ~10s
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku1, nwaku2], waku);
  });

  it("should store connected peers in cache if discovered from peer exchange", async function () {
    const mockCache = new MockPeerCache();
    waku = await createLightNode({
      networkConfig: DefaultTestNetworkConfig,
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: [(await nwaku2.getMultiaddrWithId()).toString()] })
        ]
      },
      localPeerCache: {
        cache: mockCache
      }
    });

    const discoveredPeers = new Set<string>();

    await new Promise<void>((resolve) => {
      waku.libp2p.addEventListener("peer:identify", (evt) => {
        const peerId = evt.detail.peerId;
        discoveredPeers.add(peerId.toString());

        if (discoveredPeers.size === 1) {
          resolve();
        }
      });
    });

    expect(discoveredPeers.size).to.equal(1);

    const cachedPeers = mockCache.get();
    expect(cachedPeers.length).to.equal(1);
    expect(discoveredPeers.has(cachedPeers[0].id)).to.be.true;
  });
});
