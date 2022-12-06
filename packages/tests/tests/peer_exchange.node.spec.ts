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
