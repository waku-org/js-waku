import { bootstrap } from "@libp2p/bootstrap";
import { waitForRemotePeer } from "@waku/core";
import {
  Fleet,
  getPredefinedBootstrapNodes,
} from "@waku/core/lib/predefined_bootstrap_nodes";
import { createFullNode } from "@waku/create";
import type { PeerExchangeResponse, WakuFull } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { makeLogFileName, Nwaku } from "../src/index.js";

describe("Peer Exchange: Node", () => {
  let waku: WakuFull;
  let nwaku1: Nwaku;
  let nwaku2: Nwaku;
  let nwaku3: Nwaku;
  afterEach(async function () {
    !!nwaku1 && nwaku1.stop();
    !!nwaku2 && nwaku2.stop();
    !!nwaku3 && nwaku3.stop();

    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  // skipping in CI as this test demonstrates Peer Exchange working with the test fleet
  // but not with locally run nwaku nodes
  it.skip("Locally run nwaku nodes: Queries successfully", async function () {
    this.timeout(150_000);

    console.log("starting");
    nwaku1 = new Nwaku(`node1_${makeLogFileName(this)}`);
    nwaku2 = new Nwaku(`node2_${makeLogFileName(this)}`);
    nwaku3 = new Nwaku(`node3_${makeLogFileName(this)}`);

    await nwaku1.start({
      discv5Discovery: true,
      peerExchange: true,
    });

    await delay(10000);

    await nwaku2.start({
      discv5Discovery: true,
    });

    await delay(10000);

    await nwaku3.start({
      discv5Discovery: true,
    });

    await delay(10000);

    await delay(30000);

    const waku = await createFullNode();

    await waku.start();

    await delay(1000);

    const multiaddr = await nwaku1.getMultiaddrWithId();

    await waku.dial(multiaddr, [Protocols.PeerExchange]);

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);

    await delay(3000);

    let receivedCallback = false;
    const numPeersToRequest = 3;
    const callback = (response: PeerExchangeResponse): void => {
      receivedCallback = true;
      console.log("callback", response);

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

  it("Test Fleet: Queries successfully", async function () {
    this.timeout(150_000);

    // skipping in CI as this test demonstrates Peer Exchange working with the test fleet
    // but not with locally run nwaku nodes
    if (process.env.ci) {
      this.skip();
    }

    const waku = await createFullNode({
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
});
