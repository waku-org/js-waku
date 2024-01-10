import type { PeerId } from "@libp2p/interface/peer-id";
import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { LightNode, PeerInfo } from "@waku/interfaces";
import {
  PeerExchangeCodec,
  PeerExchangeDiscovery,
  WakuPeerExchange
} from "@waku/peer-exchange";
import { createLightNode, Libp2pComponents } from "@waku/sdk";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { tearDownNodes, waitForRemotePeerWithCodec } from "../src/index.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";

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
      this.timeout(15000);
      await tearDownNodes([nwaku1, nwaku2], waku);
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
      const nwaku2PeerId = await nwaku2.getPeerId();
      const nwaku2Ma = await nwaku2.getMultiaddrWithId();

      waku = await createLightNode();
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku2Ma, PeerExchangeCodec);
      await waitForRemotePeerWithCodec(waku, PeerExchangeCodec, nwaku2PeerId);

      const components = waku.libp2p.components as unknown as Libp2pComponents;
      const peerExchange = new WakuPeerExchange(components);

      const numPeersToRequest = 1;

      let peerInfos: PeerInfo[] = [];
      while (peerInfos.length <= 0) {
        peerInfos = (await peerExchange.query({
          peerId: nwaku2PeerId,
          numPeers: numPeersToRequest
        })) as PeerInfo[];
        await delay(3000);
      }

      expect(peerInfos.length).to.be.greaterThan(0);
      expect(peerInfos.length).to.be.lessThanOrEqual(numPeersToRequest);
      expect(peerInfos[0].ENR).to.not.be.null;
      expect(peerInfos[0].ENR?.peerInfo?.multiaddrs).to.not.be.null;

      const foundNodeMultiaddrs: Multiaddr[] = [];
      const foundNodePeerId: PeerId | undefined = undefined;
      const doesPeerIdExistInResponse = peerInfos.some(
        ({ ENR }) => ENR?.peerInfo?.id.toString() === nwaku1PeerId.toString()
      );

      if (!foundNodePeerId) {
        throw new Error("Peer ID not found");
      }

      expect(doesPeerIdExistInResponse).to.be.equal(true);

      await waku.libp2p.dialProtocol(foundNodeMultiaddrs, PeerExchangeCodec);
      await waitForRemotePeerWithCodec(
        waku,
        PeerExchangeCodec,
        foundNodePeerId
      );

      expect(await waku.libp2p.peerStore.has(nwaku1PeerId)).to.eq(true);
      expect(waku.libp2p.getConnections()).has.length(2);
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
        this.timeout(15000);
        await tearDownNodes([nwaku1, nwaku2], waku);
      }
    });
  });
});
