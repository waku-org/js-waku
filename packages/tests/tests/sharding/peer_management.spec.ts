import { bootstrap } from "@libp2p/bootstrap";
import type { PeerId } from "@libp2p/interface/peer-id";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
import { createLightNode, LightNode, Tags } from "@waku/sdk";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import Sinon, { SinonSpy } from "sinon";

import { delay } from "../../src/delay.js";
import { makeLogFileName } from "../../src/log_file.js";
import { NimGoNode } from "../../src/node/node.js";
import { tearDownNodes } from "../../src/teardown.js";

chai.use(chaiAsPromised);

describe("Static Sharding: Peer Management", function () {
  describe("Peer Exchange", function () {
    let waku: LightNode;
    let nwaku1: NimGoNode;
    let nwaku2: NimGoNode;
    let nwaku3: NimGoNode;

    let dialPeerSpy: SinonSpy;

    beforeEach(async function () {
      this.timeout(15000);
      nwaku1 = new NimGoNode(makeLogFileName(this) + "1");
      nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
      nwaku3 = new NimGoNode(makeLogFileName(this) + "3");
    });

    afterEach(async function () {
      this.timeout(15000);
      await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
      dialPeerSpy && dialPeerSpy.restore();
    });

    it("all px service nodes subscribed to the shard topic should be dialed", async function () {
      this.timeout(100_000);

      const pubsubTopics = ["/waku/2/rs/18/2"];

      await nwaku1.start({
        topic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        relay: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        topic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        relay: true
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        topic: pubsubTopics,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        relay: true
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        pubsubTopics,
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
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
              if (pxPeersDiscovered.size === 2) {
                resolve();
              }
            }
          })();
        });
      });

      await delay(1000);

      expect(dialPeerSpy.callCount).to.equal(3);
    });

    it("px service nodes not subscribed to the shard should not be dialed", async function () {
      this.timeout(100_000);
      const pubsubTopicsToDial = ["/waku/2/rs/18/2"];
      const pubsubTopicsToIgnore = ["/waku/2/rs/18/3"];

      // this service node is not subscribed to the shard
      await nwaku1.start({
        topic: pubsubTopicsToIgnore,
        relay: true,
        discv5Discovery: true,
        peerExchange: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        topic: pubsubTopicsToDial,
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        pubsubTopics: pubsubTopicsToDial,
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery()
          ]
        }
      });

      dialPeerSpy = Sinon.spy((waku as any).connectionManager, "dialPeer");

      await waku.start();

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

      await delay(1000);
      expect(dialPeerSpy.callCount).to.equal(2);
    });
  });
});
