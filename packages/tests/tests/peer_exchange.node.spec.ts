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

async function assertPxPeersExist(
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

describe("Peer Exchange", async function () {
  let waku: LightNode;
  afterEach(async function () {
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Manual query on the Test Fleet returns a PX node", async function () {
    this.timeout(25_000);

    // skipping in CI as this test demonstrates Peer Exchange working with the test fleet
    // but not with locally run nwaku nodes
    if (process.env.CI) {
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
});

//There's currently no way to be sure if a discvoered PX peer is dialable
// ref: https://github.com/waku-org/nwaku/issues/1484#issuecomment-1379955087
describe.skip("Peer Exchange Dials", () => {
  let waku: LightNode;
  afterEach(async function () {
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Auto discovery", async function () {
    this.timeout(15_000);

    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: getPredefinedBootstrapNodes(Fleet.Test) }),
          wakuPeerExchangeDiscovery(),
        ],
      },
    });

    await waku.start();
    await delay(12000);

    const pxPeers = await assertPxPeersExist(waku);

    if (!pxPeers) throw new Error("No PX peers found");

    expect(pxPeers.length).to.be.greaterThan(0);
  });

  it("Manual query on test fleet", async function () {
    this.timeout(50_000);

    // skipping in CI as this test demonstrates Peer Exchange working with the test fleet
    // but not with locally run nwaku nodes
    if (process.env.CI) {
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

    await assertPxPeersExist(waku);

    expect(receivedCallback).to.be.true;
  });
});
