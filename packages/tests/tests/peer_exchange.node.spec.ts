import { bootstrap } from "@libp2p/bootstrap";
import {
  Fleet,
  getPredefinedBootstrapNodes,
} from "@waku/core/lib/predefined_bootstrap_nodes";
import { createLightNode } from "@waku/create";
import type { LightNode } from "@waku/interfaces";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
import { DEFAULT_PEER_EXCHANGE_TAG_NAME } from "@waku/peer-exchange";
import { expect } from "chai";

import { delay } from "../src/delay.js";

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
    this.timeout(60_000);

    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: getPredefinedBootstrapNodes(Fleet.Test) }),
          wakuPeerExchangeDiscovery(),
        ],
      },
    });

    await waku.start();
    // we want to ensure that there is enough time for discv5 to discover peers
    await delay(40000);

    const pxPeers = waku.libp2p
      .getConnections()
      .map((c) => c.tags.includes(DEFAULT_PEER_EXCHANGE_TAG_NAME)).length;
    expect(pxPeers).to.be.greaterThan(0);
  });
});
