import type { LightNode, PartialPeerInfo, PeerCache } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";
import Sinon, { SinonSpy } from "sinon";

import {
  afterEachCustom,
  beforeEachCustom,
  DefaultTestClusterId,
  DefaultTestNetworkConfig,
  DefaultTestShardInfo,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

class MockPeerCache implements PeerCache {
  public data: PartialPeerInfo[] = [];

  public get(): PartialPeerInfo[] {
    return this.data;
  }

  public set(value: PartialPeerInfo[]): void {
    this.data = value;
  }

  public remove(): void {
    this.data = [];
  }
}

describe("Peer Cache Discovery", function () {
  this.timeout(150_000);
  let ctx: Mocha.Context;
  let waku: LightNode;

  let nwaku1: ServiceNode;
  let nwaku2: ServiceNode;

  let dialPeerSpy: SinonSpy;

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
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku1, nwaku2], waku);
  });

  it("should discover peers from provided peer cache", async function () {
    const mockCache = new MockPeerCache();

    mockCache.set([
      {
        id: (await nwaku1.getPeerId()).toString(),
        multiaddrs: [(await nwaku1.getMultiaddrWithId()).toString()]
      },
      {
        id: (await nwaku2.getPeerId()).toString(),
        multiaddrs: [(await nwaku2.getMultiaddrWithId()).toString()]
      }
    ]);

    waku = await createLightNode({
      networkConfig: DefaultTestNetworkConfig,
      discovery: {
        peerExchange: true,
        localPeerCache: true
      },
      localPeerCache: {
        cache: mockCache
      }
    });

    dialPeerSpy = Sinon.spy((waku as any).libp2p, "dial");

    const discoveredPeers = new Set<string>();
    await new Promise<void>((resolve) => {
      waku.libp2p.addEventListener("peer:identify", (evt) => {
        const peerId = evt.detail.peerId;
        discoveredPeers.add(peerId.toString());

        if (discoveredPeers.size === 2) {
          resolve();
        }
      });
    });

    expect(dialPeerSpy.callCount).to.equal(2);
    expect(discoveredPeers.size).to.equal(2);
  });

  it("should monitor connected peers and store them into cache", async function () {
    const mockCache = new MockPeerCache();

    waku = await createLightNode({
      networkConfig: DefaultTestNetworkConfig,
      bootstrapPeers: [(await nwaku2.getMultiaddrWithId()).toString()],
      discovery: {
        peerExchange: true,
        peerCache: true
      },
      peerCache: mockCache
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
