import { bootstrap } from "@libp2p/bootstrap";
import tests from "@libp2p/interface-peer-discovery-compliance-tests";
import { PeerId } from "@libp2p/interface-peer-id";
import {
  Fleet,
  getPredefinedBootstrapNodes,
} from "@waku/core/lib/predefined_bootstrap_nodes";
import { LightNode, PeerInfo, Tags } from "@waku/interfaces";
import {
  PeerExchangeCodec,
  PeerExchangeDiscovery,
  WakuPeerExchange,
  wakuPeerExchangeDiscovery,
} from "@waku/peer-exchange";
import { createLightNode, Libp2pComponents } from "@waku/sdk";
import { expect } from "chai";
import sinon, { SinonSpy } from "sinon";

import { delay } from "../src/delay.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";

describe("Peer Exchange", () => {
  let waku: LightNode;

  afterEach(async function () {
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Auto discovery", async function () {
    // skipping in CI as this test demonstrates Peer Exchange working with the test fleet
    // but not with locally run nwaku nodes
    if (process.env.CI) {
      this.skip();
    }

    this.timeout(50_000);

    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: getPredefinedBootstrapNodes(Fleet.Test, 3) }),
          wakuPeerExchangeDiscovery(),
        ],
      },
    });

    await waku.start();

    const foundPxPeer = await new Promise<boolean>((resolve) => {
      const testNodes = getPredefinedBootstrapNodes(Fleet.Test, 3);
      waku.libp2p.addEventListener("peer:discovery", (evt) => {
        const { multiaddrs } = evt.detail;
        multiaddrs.forEach((ma) => {
          const isBootstrapNode = testNodes.find((n) => n === ma.toString());
          if (!isBootstrapNode) {
            resolve(true);
          }
        });
      });
    });

    expect(foundPxPeer).to.be.true;
  });

  describe("Locally run nodes", () => {
    let waku: LightNode;
    let nwaku1: NimGoNode;
    let nwaku2: NimGoNode;

    beforeEach(async function () {
      nwaku1 = new NimGoNode(makeLogFileName(this) + "1");
      nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    });

    afterEach(async function () {
      !!nwaku1 && nwaku1.stop();
      !!nwaku2 && nwaku2.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    it("nwaku interop", async function () {
      this.timeout(55_000);

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
      });

      const enr = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr,
      });

      const nwaku1PeerId = await nwaku1.getPeerId();
      const nwaku2Ma = await nwaku2.getMultiaddrWithId();

      waku = await createLightNode();
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku2Ma, PeerExchangeCodec);

      await new Promise<void>((resolve) => {
        waku.libp2p.peerStore.addEventListener("change:protocols", (evt) => {
          if (evt.detail.protocols.includes(PeerExchangeCodec)) {
            resolve();
          }
        });
      });

      // the forced type casting is done in ref to https://github.com/libp2p/js-libp2p-interfaces/issues/338#issuecomment-1431643645
      const { connectionManager, registrar, peerStore } =
        waku.libp2p as unknown as Libp2pComponents;
      const components = {
        connectionManager: connectionManager,
        registrar: registrar,
        peerStore: peerStore,
      };

      const peerExchange = new WakuPeerExchange(components);

      const numPeersToRequest = 1;

      let peerInfos: PeerInfo[] = [];
      while (peerInfos.length <= 0) {
        peerInfos = (await peerExchange.query({
          numPeers: numPeersToRequest,
        })) as PeerInfo[];
        await delay(3000);
      }

      expect(peerInfos.length).to.be.greaterThan(0);
      expect(peerInfos.length).to.be.lessThanOrEqual(numPeersToRequest);
      expect(peerInfos[0].ENR).to.not.be.null;

      const doesPeerIdExistInResponse =
        peerInfos.find(
          ({ ENR }) => ENR?.peerInfo?.id.toString() === nwaku1PeerId.toString()
        ) !== undefined;

      expect(doesPeerIdExistInResponse).to.be.equal(true);

      expect(waku.libp2p.peerStore.has(await nwaku2.getPeerId())).to.be.true;
    });
  });

  describe("Compliance Test", async function () {
    this.timeout(55_000);

    let waku: LightNode;
    let nwaku1: NimGoNode;
    let nwaku2: NimGoNode;

    beforeEach(async function () {
      nwaku1 = new NimGoNode(makeLogFileName(this) + "1");
      nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    });

    tests({
      async setup() {
        await nwaku1.start({
          relay: true,
          discv5Discovery: true,
          peerExchange: true,
        });

        const enr = (await nwaku1.info()).enrUri;

        await nwaku2.start({
          relay: true,
          discv5Discovery: true,
          peerExchange: true,
          discv5BootstrapNode: enr,
        });

        waku = await createLightNode();

        await waku.start();
        const nwaku2Ma = await nwaku2.getMultiaddrWithId();

        await waku.libp2p.dialProtocol(nwaku2Ma, PeerExchangeCodec);
        await new Promise<void>((resolve) => {
          waku.libp2p.peerStore.addEventListener("change:protocols", (evt) => {
            if (evt.detail.protocols.includes(PeerExchangeCodec)) {
              resolve();
            }
          });
        });

        // the forced type casting is done in ref to https://github.com/libp2p/js-libp2p-interfaces/issues/338#issuecomment-1431643645
        const { connectionManager, registrar, peerStore } =
          waku.libp2p as unknown as Libp2pComponents;
        const components = {
          connectionManager: connectionManager,
          registrar: registrar,
          peerStore: peerStore,
        };

        return new PeerExchangeDiscovery(components);
      },
      teardown: async () => {
        !!nwaku1 && (await nwaku1.stop());
        !!nwaku2 && (await nwaku2.stop());
        !!waku && (await waku.stop());
      },
    });
  });

  describe("Sharding", function () {
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
      !!nwaku1 && nwaku1.stop();
      !!nwaku2 && nwaku2.stop();
      !!nwaku3 && nwaku3.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));

      attemptDialSpy && attemptDialSpy.restore();
    });

    it.only("all px service nodes subscribed to the shard topic should be dialed", async function () {
      this.timeout(100_000);

      await nwaku1.start({
        topic: "/waku/2/rs/18/2",
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        topic: "/waku/2/rs/18/2",
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        topic: "/waku/2/rs/18/2",
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        pubSubTopic: "/waku/2/rs/18/2",
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery(),
          ],
        },
      });

      await waku.start();

      attemptDialSpy = sinon.spy(
        (waku as any).connectionManager,
        "attemptDial"
      );

      await new Promise<void>((resolve) => {
        waku.libp2p.peerStore.addEventListener(
          "change:protocols",
          async (evt) => {
            if (evt.detail.protocols.includes(PeerExchangeCodec)) {
              resolve();
            }
          }
        );
      });

      const pxPeersDiscovered = new Set<PeerId>();

      await new Promise<void>((resolve) => {
        waku.libp2p.addEventListener("peer:discovery", async (evt) => {
          const peerId = evt.detail.id;
          const tags = (await waku.libp2p.peerStore.getTags(peerId)).map(
            (t) => t.name
          );
          if (tags.includes(Tags.PEER_EXCHANGE)) {
            pxPeersDiscovered.add(peerId);
            if (pxPeersDiscovered.size === 2) {
              resolve();
            }
          }
        });
      });

      await delay(1000);

      expect(attemptDialSpy.callCount).to.equal(3);
    });

    it.only("px service nodes not subscribed to the shard should not be dialed", async function () {
      this.timeout(100_000);

      // this service node is not subscribed to the shard
      await nwaku1.start({
        topic: "/waku/2/rs/17/0",
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
      });

      const enr1 = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        topic: "/waku/2/rs/18/2",
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr1,
      });

      const enr2 = (await nwaku2.info()).enrUri;

      await nwaku3.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr2,
      });
      const nwaku3Ma = await nwaku3.getMultiaddrWithId();

      waku = await createLightNode({
        pubSubTopic: "/waku/2/rs/18/2",
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: [nwaku3Ma.toString()] }),
            wakuPeerExchangeDiscovery(),
          ],
        },
      });

      attemptDialSpy = sinon.spy(
        (waku as any).connectionManager,
        "attemptDial"
      );

      await waku.start();

      const pxPeersDiscovered = new Set<PeerId>();

      await new Promise<void>((resolve) => {
        waku.libp2p.addEventListener("peer:discovery", async (evt) => {
          const peerId = evt.detail.id;
          const tags = (await waku.libp2p.peerStore.getTags(peerId)).map(
            (t) => t.name
          );
          if (tags.includes(Tags.PEER_EXCHANGE)) {
            pxPeersDiscovered.add(peerId);
            if (pxPeersDiscovered.size === 1) {
              resolve();
            }
          }
        });
      });

      await delay(1000);

      expect(attemptDialSpy.callCount).to.equal(2);
    });
  });
});
