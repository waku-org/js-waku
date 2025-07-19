import { bootstrap } from "@libp2p/bootstrap";
import type { PeerId } from "@libp2p/interface";
import { wakuPeerExchangeDiscovery } from "@waku/discovery";
import type { LightNode } from "@waku/interfaces";
import { createLightNode, Tags } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { expect } from "chai";
import Sinon, { SinonSpy } from "sinon";

import {
  afterEachCustom,
  beforeEachCustom,
  DefaultTestClusterId,
  DefaultTestNetworkConfig,
  DefaultTestRelayShards,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

export const log = new Logger("test:pe");

describe("Peer Exchange", function () {
  this.timeout(150_000);
  let waku: LightNode;
  let nwaku1: ServiceNode;
  let nwaku2: ServiceNode;
  let nwaku3: ServiceNode;
  let dialPeerSpy: SinonSpy;

  beforeEachCustom(this, async () => {
    nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
    nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
    await nwaku1.start({
      clusterId: DefaultTestClusterId,
      shard: DefaultTestRelayShards.shards,
      discv5Discovery: true,
      peerExchange: true,
      relay: true
    });
    await nwaku2.start({
      clusterId: DefaultTestClusterId,
      shard: DefaultTestRelayShards.shards,
      discv5Discovery: true,
      peerExchange: true,
      discv5BootstrapNode: (await nwaku1.info()).enrUri,
      relay: true
    });
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
  });

  it("peer exchange sets tag", async function () {
    waku = await createLightNode({
      networkConfig: DefaultTestNetworkConfig,
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: [(await nwaku2.getMultiaddrWithId()).toString()] }),
          wakuPeerExchangeDiscovery()
        ]
      }
    });
    await waku.start();

    dialPeerSpy = Sinon.spy((waku as any).libp2p, "dial");
    const pxPeersDiscovered = new Set<PeerId>();

    await new Promise<void>((resolve) => {
      waku.libp2p.addEventListener("peer:discovery", (evt) => {
        return void (async () => {
          const peerId = evt.detail.id;
          const peer = await waku.libp2p.peerStore.get(peerId);
          const tags = Array.from(peer.tags.keys());
          if (tags.includes(Tags.PEER_EXCHANGE)) {
            pxPeersDiscovered.add(peerId);
            if (pxPeersDiscovered.size === 1) {
              resolve();
            }
          }
        })();
      });
    });

    expect(dialPeerSpy.callCount).to.equal(1);
    expect(pxPeersDiscovered.size).to.equal(1);
  });

  // will be skipped until https://github.com/waku-org/js-waku/issues/1860 is fixed
  it.skip("new peer added after a peer was already found", async function () {
    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: [(await nwaku2.getMultiaddrWithId()).toString()] }),
          wakuPeerExchangeDiscovery()
        ]
      }
    });
    await waku.start();

    dialPeerSpy = Sinon.spy((waku as any).connectionManager, "dialPeer");
    const pxPeersDiscovered = new Set<PeerId>();
    await new Promise<void>((resolve) => {
      waku.libp2p.addEventListener("peer:discovery", (evt) => {
        return void (async () => {
          const peerId = evt.detail.id;
          const peer = await waku.libp2p.peerStore.get(peerId);
          const tags = Array.from(peer.tags.keys());
          if (tags.includes(Tags.PEER_EXCHANGE)) {
            pxPeersDiscovered.add(peerId);
            if (pxPeersDiscovered.size === 1) {
              resolve();
            }
          }
        })();
      });
    });

    nwaku3 = new ServiceNode(makeLogFileName(this) + "3");
    await nwaku3.start({
      clusterId: DefaultTestClusterId,
      shard: DefaultTestRelayShards.shards,
      discv5Discovery: true,
      peerExchange: true,
      discv5BootstrapNode: (await nwaku1.info()).enrUri,
      relay: true,
      lightpush: true,
      filter: true
    });

    await new Promise<void>((resolve) => {
      waku.libp2p.addEventListener("peer:discovery", (evt) => {
        return void (async () => {
          const peerId = evt.detail.id;
          const peer = await waku.libp2p.peerStore.get(peerId);
          const tags = Array.from(peer.tags.keys());
          if (tags.includes(Tags.PEER_EXCHANGE)) {
            pxPeersDiscovered.add(peerId);
            if (pxPeersDiscovered.size === 2) {
              resolve();
            }
          }
        })();
      });
    });
  });

  // will be skipped until https://github.com/waku-org/js-waku/issues/1858 is fixed
  it.skip("wrong wakuPeerExchangeDiscovery pubsub topic", async function () {
    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: [(await nwaku2.getMultiaddrWithId()).toString()] }),
          wakuPeerExchangeDiscovery()
        ]
      }
    });
    await waku.start();
    dialPeerSpy = Sinon.spy((waku as any).connectionManager, "dialPeer");

    const pxPeersDiscovered = new Set<PeerId>();
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, 40000);

      waku.libp2p.addEventListener("peer:discovery", (evt) => {
        return void (async () => {
          const peerId = evt.detail.id;
          const peer = await waku.libp2p.peerStore.get(peerId);
          const tags = Array.from(peer.tags.keys());
          if (tags.includes(Tags.PEER_EXCHANGE)) {
            pxPeersDiscovered.add(peerId);
            if (pxPeersDiscovered.size === 1) {
              clearTimeout(timeoutId);
              resolve();
            }
          }
        })();
      });
    });

    expect(
      pxPeersDiscovered.size,
      "No peer should have been discovered"
    ).to.equal(0);
  });

  it("peerDiscovery without wakuPeerExchangeDiscovery", async function () {
    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: [(await nwaku2.getMultiaddrWithId()).toString()] })
        ]
      }
    });
    await waku.start();
    dialPeerSpy = Sinon.spy((waku as any).libp2p, "dial");

    const pxPeersDiscovered = new Set<PeerId>();
    await new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, 40000);

      waku.libp2p.addEventListener("peer:discovery", (evt) => {
        return void (async () => {
          const peerId = evt.detail.id;
          const peer = await waku.libp2p.peerStore.get(peerId);
          const tags = Array.from(peer.tags.keys());
          if (tags.includes(Tags.PEER_EXCHANGE)) {
            pxPeersDiscovered.add(peerId);
            if (pxPeersDiscovered.size === 1) {
              clearTimeout(timeoutId);
              resolve();
            }
          }
        })();
      });
    });

    expect(
      pxPeersDiscovered.size,
      "No peer should have been discovered"
    ).to.equal(0);
  });
});
