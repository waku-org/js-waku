import { bootstrap } from "@libp2p/bootstrap";
import type { PeerId } from "@libp2p/interface";
import { wakuPeerExchangeDiscovery } from "@waku/discovery";
import type { LightNode, PeersByDiscoveryResult } from "@waku/interfaces";
import { createLightNode, Tags } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { expect } from "chai";
import Sinon, { SinonSpy } from "sinon";

import {
  afterEachCustom,
  beforeEachCustom,
  DefaultTestShardInfo,
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
  let nwaku1PeerId: PeerId;

  beforeEachCustom(this, async () => {
    nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
    nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
    await nwaku1.start({
      clusterId: DefaultTestShardInfo.clusterId,
      shard: DefaultTestShardInfo.shards,
      discv5Discovery: true,
      peerExchange: true,
      relay: true
    });
    await nwaku2.start({
      clusterId: DefaultTestShardInfo.clusterId,
      shard: DefaultTestShardInfo.shards,
      discv5Discovery: true,
      peerExchange: true,
      discv5BootstrapNode: (await nwaku1.info()).enrUri,
      relay: true
    });
    nwaku1PeerId = await nwaku1.getPeerId();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
  });

  it("getPeersByDiscovery", async function () {
    waku = await createLightNode({
      networkConfig: DefaultTestShardInfo,
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
    expect(dialPeerSpy.callCount).to.equal(1);

    const peers_after = <PeersByDiscoveryResult>(
      await waku.connectionManager.getPeersByDiscovery()
    );
    const discovered_peer_exchange = peers_after.DISCOVERED[Tags.PEER_EXCHANGE];
    const discovered_bootstram = peers_after.DISCOVERED[Tags.BOOTSTRAP];
    const connected_peer_exchange = peers_after.CONNECTED[Tags.PEER_EXCHANGE];
    const connected_bootstram = peers_after.CONNECTED[Tags.BOOTSTRAP];
    expect(discovered_peer_exchange.length).to.eq(1);
    expect(discovered_peer_exchange[0].id.toString()).to.eq(
      nwaku1PeerId.toString()
    );
    expect(discovered_peer_exchange[0].tags.has("peer-exchange")).to.be.true;
    expect(discovered_bootstram.length).to.eq(1);
    expect(connected_peer_exchange.length).to.eq(0);
    expect(connected_bootstram.length).to.eq(1);
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
      clusterId: DefaultTestShardInfo.clusterId,
      shard: DefaultTestShardInfo.shards,
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
});
