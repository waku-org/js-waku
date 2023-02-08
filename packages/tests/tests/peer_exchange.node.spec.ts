import { bootstrap } from "@libp2p/bootstrap";
import tests from "@libp2p/interface-peer-discovery-compliance-tests";
import { waitForRemotePeer } from "@waku/core";
import {
  Fleet,
  getPredefinedBootstrapNodes,
} from "@waku/core/lib/predefined_bootstrap_nodes";
import { createLightNode } from "@waku/create";
import type { LightNode, PeerExchangeResponse } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import {
  PeerExchangeDiscovery,
  wakuPeerExchangeDiscovery,
} from "@waku/peer-exchange";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { makeLogFileName } from "../src/log_file.js";
import { Nwaku } from "../src/nwaku.js";

describe("Peer Exchange", () => {
  let waku: LightNode;

  before(async function () {
    // skipping in CI as this test demonstrates Peer Exchange working with the test fleet
    // but not with locally run nwaku nodes
    if (process.env.CI) {
      this.skip();
    }
  });

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
    await delay(100000);

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);
    const pxPeers = await waku.peerExchange.peers();
    expect(pxPeers.length).to.be.greaterThan(0);
  });

  it("Manual query on test fleet", async function () {
    this.timeout(150_000);

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
      nwaku1 = new Nwaku(makeLogFileName(this) + "1");
      nwaku2 = new Nwaku(makeLogFileName(this) + "2");
    });

    afterEach(async function () {
      !!nwaku1 && nwaku1.stop();
      !!nwaku2 && nwaku2.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    it("nwaku interop", async function () {
      this.timeout(25_000);

      await nwaku1.start({
        discv5Discovery: true,
        peerExchange: true,
      });

      const enr = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr,
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku2Ma = await nwaku2.getMultiaddrWithId();

      waku = await createLightNode();
      await waku.start();
      await waku.dial(nwaku2Ma);

      await waitForRemotePeer(waku, [Protocols.PeerExchange]);

      await nwaku2.waitForLog("Discovered px peers via discv5", 1);

      let receivedCallback = false;

      const numPeersToRequest = 1;
      const callback = async (
        response: PeerExchangeResponse
      ): Promise<void> => {
        const doesMultiaddrExist = response.peerInfos.find(
          (peerInfo) =>
            peerInfo.ENR?.getFullMultiaddrs()?.find((multiaddr) =>
              multiaddr.equals(nwaku1Ma)
            ) !== undefined
        );

        expect(response.peerInfos.length).to.be.greaterThan(0);
        expect(response.peerInfos.length).to.be.lessThanOrEqual(
          numPeersToRequest
        );
        expect(response.peerInfos[0].ENR).to.not.be.null;

        expect(doesMultiaddrExist).to.be.equal(true);

        expect(waku.libp2p.peerStore.has(await nwaku2.getPeerId())).to.be.true;

        receivedCallback = true;
      };

      await waku.peerExchange.query(
        {
          numPeers: numPeersToRequest,
        },
        callback
      );

      expect(receivedCallback).to.be.true;
    });
  });

  describe.only("compliance test", async function () {
    this.timeout(25_000);

    let waku: LightNode;
    let nwaku1: Nwaku;
    let nwaku2: Nwaku;

    tests({
      async setup() {
        nwaku1 = new Nwaku("1");
        nwaku2 = new Nwaku("2");
        await nwaku1.start({
          discv5Discovery: true,
          peerExchange: true,
        });

        const enr = (await nwaku1.info()).enrUri;

        await nwaku2.start({
          discv5Discovery: true,
          peerExchange: true,
          discv5BootstrapNode: enr,
        });

        waku = await createLightNode();

        await waku.start();
        const nwaku2Ma = await nwaku2.getMultiaddrWithId();

        setTimeout(async () => {
          await waku.dial(nwaku2Ma);
          await waitForRemotePeer(waku, [Protocols.PeerExchange]);
        }, 1000);

        return new PeerExchangeDiscovery(waku.libp2p);
      },
      teardown: async () => {
        !!nwaku1 && nwaku1.stop();
        !!nwaku2 && nwaku2.stop();
        !!waku && (await waku.stop());
      },
    });
  });
});
