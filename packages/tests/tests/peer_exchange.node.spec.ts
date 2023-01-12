import { bootstrap } from "@libp2p/bootstrap";
import { Peer } from "@libp2p/interface-peer-store";
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

async function checkIfPxPeersExist(
  waku: LightNode
): Promise<Peer[] | undefined> {
  const allPeers = await waku.libp2p.peerStore.all();
  expect(allPeers.length).to.be.greaterThan(0);

  const pxPeers: Peer[] = [];
  for (const peer of allPeers) {
    const tags = await waku.libp2p.peerStore.getTags(peer.id);
    let hasTag = false;
    for (const tag of tags) {
      hasTag = tag.name === "peer-exchange";
      if (hasTag) {
        pxPeers.push(peer);
        break;
      }
    }
    expect(hasTag).to.be.eq(true);
    return pxPeers;
  }
  return undefined;
}

describe("Peer Exchange", () => {
  let waku: LightNode;
  afterEach(async function () {
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it.only("Auto discovery", async function () {
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
    await delay(150000);

    const pxPeers = await checkIfPxPeersExist(waku);

    if (!pxPeers) throw new Error("No PX peers found");

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

    await checkIfPxPeersExist(waku);

    expect(receivedCallback).to.be.true;
  });
});
