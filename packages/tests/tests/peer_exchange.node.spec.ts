import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import type { LightNode, PeerInfo } from "@waku/interfaces";
import {
  PeerExchangeCodec,
  PeerExchangeDiscovery,
  WakuPeerExchange
} from "@waku/peer-exchange";
import { createLightNode, Libp2pComponents } from "@waku/sdk";
import { expect } from "chai";

import { delay } from "../src/delay";
import { makeLogFileName } from "../src/log_file";
import { NimGoNode } from "../src/node/node";

describe("Peer Exchange", () => {
  describe("Locally Run Nodes", () => {
    let waku: LightNode;
    let nwaku1: NimGoNode;
    let nwaku2: NimGoNode;

    beforeEach(function () {
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
        peerExchange: true
      });

      const enr = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr
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
          numPeers: numPeersToRequest
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
          peerExchange: true
        });

        const enr = (await nwaku1.info()).enrUri;

        await nwaku2.start({
          relay: true,
          discv5Discovery: true,
          peerExchange: true,
          discv5BootstrapNode: enr
        });

        waku = await createLightNode();
        await waku.start();

        const nwaku2Ma = await nwaku2.getMultiaddrWithId();

        // we do this because we want peer-exchange discovery to get initialised before we dial the peer which contains info about the other peer
        setTimeout(() => {
          void waku.libp2p.dialProtocol(nwaku2Ma, PeerExchangeCodec);
        }, 1000);

        return new PeerExchangeDiscovery(waku.libp2p.components);
      },
      teardown: async () => {
        await nwaku1?.stop();
        await nwaku2?.stop();
        await waku?.stop();
      }
    });
  });
});
