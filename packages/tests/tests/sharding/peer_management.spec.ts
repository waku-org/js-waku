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

chai.use(chaiAsPromised);

describe("Static Sharding: Peer Management", function () {
  describe("Peer Exchange", function () {
    let waku: LightNode;
    let nwaku1: NimGoNode;
    let nwaku2: NimGoNode;
    let nwaku3: NimGoNode;

    let attemptDialSpy: SinonSpy;

    beforeEach(async function () {
      nwaku1 = new NimGoNode(makeLogFileName(this) + "1");
      nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
      nwaku3 = new NimGoNode(makeLogFileName(this) + "3");
    });

    afterEach(async function () {
      this.timeout(5_000);
      await nwaku1?.stop();
      await nwaku2?.stop();
      await nwaku3?.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));

      attemptDialSpy && attemptDialSpy.restore();
    });

    it("all px service nodes subscribed to the shard topic should be dialed", async function () {
      this.timeout(100_000);

      await nwaku1.start({
        topic: "/waku/2/rs/18/2",
        discv5Discovery: true,
        peerExchange: true,
        relay: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        topic: "/waku/2/rs/18/2",
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
        relay: true
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        topic: "/waku/2/rs/18/2",
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
        relay: true
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        pubSubTopics: ["/waku/2/rs/18/2"],
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery()
          ]
        }
      });

      await waku.start();

      attemptDialSpy = Sinon.spy(
        (waku as any).connectionManager,
        "attemptDial"
      );

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
                console.log("done");
                resolve();
              }
            }
          })();
        });
      });

      await delay(1000);

      console.log(attemptDialSpy.callCount);

      expect(attemptDialSpy.callCount).to.equal(3);
    });

    it("px service nodes not subscribed to the shard should not be dialed", async function () {
      this.timeout(100_000);

      // this service node is not subscribed to the shard
      await nwaku1.start({
        topic: "/waku/2/rs/17/0",
        relay: true,
        discv5Discovery: true,
        peerExchange: true
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        topic: "/waku/2/rs/18/2",
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
        pubSubTopics: ["/waku/2/rs/18/2"],
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery()
          ]
        }
      });

      attemptDialSpy = Sinon.spy(
        (waku as any).connectionManager,
        "attemptDial"
      );

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

      expect(attemptDialSpy.callCount).to.equal(2);
    });
  });
});
