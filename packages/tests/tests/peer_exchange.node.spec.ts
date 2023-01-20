import { bootstrap } from "@libp2p/bootstrap";
import { waitForRemotePeer } from "@waku/core";
import {
  Fleet,
  getPredefinedBootstrapNodes,
} from "@waku/core/lib/predefined_bootstrap_nodes";
import { createLightNode } from "@waku/create";
import type { LightNode, PeerExchangeResponse } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { makeLogFileName } from "../src/log_file.js";
import { Nwaku } from "../src/nwaku.js";

describe("Peer Exchange", () => {
  let waku: LightNode;
  afterEach(async function () {
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Auto discovery", async function () {
    this.timeout(120_000);

    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: getPredefinedBootstrapNodes(Fleet.Test) }),
          wakuPeerExchangeDiscovery(),
        ],
      },
    });

    await waku.start();
    await delay(1000);

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);
    const pxPeers = await waku.peerExchange.peers();
    expect(pxPeers.length).to.be.greaterThan(0);
  });

  it("Manual query on test fleet", async function () {
    this.timeout(150_000);

    // skipping in CI as this test demonstrates Peer Exchange working with the test fleet
    // but not with locally run nwaku nodes
    if (process.env.ci) {
      this.skip();
    }

    const waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: getPredefinedBootstrapNodes(Fleet.Test) }),
        ],
      },
    });

    await waku.start();

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);

    let receivedCallback = false;
    const numPeersToRequest = 3;
    const callback = (response: PeerExchangeResponse): void => {
      receivedCallback = true;
      expect(response.peerInfos.length).to.be.greaterThan(0);
      expect(response.peerInfos.length).to.be.lessThanOrEqual(
        numPeersToRequest
      );

      expect(response.peerInfos[0].ENR).to.not.be.null;
    };

    await waku.peerExchange.query(
      {
        numPeers: numPeersToRequest,
      },
      callback
    );

    expect(receivedCallback).to.be.true;
  });

  describe("Locally run nodes", () => {
    let waku: LightNode;
    let nwaku1: Nwaku;
    let nwaku2: Nwaku;

    beforeEach(async function () {
      this.timeout(50_000);
      nwaku1 = new Nwaku(makeLogFileName(this) + "1");
      nwaku2 = new Nwaku(makeLogFileName(this) + "2");
    });

    afterEach(async function () {
      !!nwaku1 && nwaku1.stop();
      !!nwaku2 && nwaku2.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    it("nwaku interop", async function () {
      this.timeout(50_000);

      await nwaku1.start({
        discv5Discovery: true,
        peerExchange: true,
        discv5UdpPort: 9007,
      });

      const enr = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr,
        discv5UdpPort: 9043,
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku2Ma = await nwaku2.getMultiaddrWithId();

      waku = await createLightNode();
      await waku.start();
      await waku.dial(nwaku2Ma);

      await waitForRemotePeer(waku, [Protocols.PeerExchange]);

      await delay(20000);

      const numPeersToRequest = 1;
      const callback = async (
        response: PeerExchangeResponse
      ): Promise<void> => {
        const multiaddrsArr = response.peerInfos.map(
          (peerInfo) => peerInfo.ENR && peerInfo.ENR.getFullMultiaddrs()
        );

        let isMultiaddrMatch = false;

        multiaddrsArr.forEach((multiaddrs) => {
          if (!multiaddrs) return;
          multiaddrs.forEach((multiaddr) => {
            if (!multiaddr || !multiaddr.equals(nwaku1Ma)) return;
            isMultiaddrMatch = true;
          });
        });

        expect(response.peerInfos.length).to.be.greaterThan(0);
        expect(response.peerInfos.length).to.be.lessThanOrEqual(
          numPeersToRequest
        );
        expect(response.peerInfos[0].ENR).to.not.be.null;

        expect(isMultiaddrMatch).to.be.equal(true);

        const peersInPeerstore = (await waku.libp2p.peerStore.all()).length;
        expect(peersInPeerstore).to.be.greaterThan(1);
      };

      await waku.peerExchange.query(
        {
          numPeers: numPeersToRequest,
        },
        callback
      );
    });
  });
});
