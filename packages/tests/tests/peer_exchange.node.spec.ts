import { bootstrap } from "@libp2p/bootstrap";
import tests from "@libp2p/interface-peer-discovery-compliance-tests";
import {
  Fleet,
  getPredefinedBootstrapNodes,
} from "@waku/core/lib/predefined_bootstrap_nodes";
import type { LightNode, PeerInfo } from "@waku/interfaces";
import {
  PeerExchangeCodec,
  PeerExchangeDiscovery,
  WakuPeerExchange,
  wakuPeerExchangeDiscovery,
} from "@waku/peer-exchange";
import { createLightNode, Libp2pComponents } from "@waku/sdk";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";

describe("Peer Exchange", () => {
  describe("Auto Discovery", function () {
    let waku: LightNode;

    afterEach(async function () {
      await waku?.stop();
    });

    it("connection with fleet nodes", async function () {
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
          const peerId = evt.detail.id.toString();
          const isBootstrapNode = testNodes.find((n) => n.includes(peerId));
          if (!isBootstrapNode) {
            resolve(true);
          }
        });
      });

      expect(foundPxPeer).to.be.true;
    });
  });

  describe("Locally Run Nodes", () => {
    let waku: LightNode;
    let nwaku1: NimGoNode;
    let nwaku2: NimGoNode;

    beforeEach(async function () {
      nwaku1 = new NimGoNode(makeLogFileName(this) + "1");
      nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    });

    afterEach(async function () {
      this.timeout(10_000);
      await nwaku1?.stop();
      await nwaku2?.stop();
      await waku?.stop();
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

      const components = waku.libp2p.components as unknown as Libp2pComponents;
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

      expect(await waku.libp2p.peerStore.has(await nwaku2.getPeerId())).to.be
        .true;
    });
  });

  describe("Compliance Test", function () {
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

        waku = await createLightNode({
          libp2p: {
            peerDiscovery: [wakuPeerExchangeDiscovery()],
          },
        });
        const peerExchange = waku.libp2p.components["components"][
          "peer-discovery-0"
        ] as PeerExchangeDiscovery;

        await waku.start();
        const nwaku2Ma = await nwaku2.getMultiaddrWithId();

        await waku.libp2p.dialProtocol(nwaku2Ma, PeerExchangeCodec);

        return peerExchange;
      },
      teardown: async () => {
        await nwaku1?.stop();
        await nwaku2?.stop();
        await waku?.stop();
      },
    });
  });
});
