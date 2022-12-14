import { bootstrap } from "@libp2p/bootstrap";
import { waitForRemotePeer } from "@waku/core";
import {
  Fleet,
  getPredefinedBootstrapNodes,
} from "@waku/core/lib/predefined_bootstrap_nodes";
import { createLightNode } from "@waku/create";
import { Protocols, Waku } from "@waku/interfaces";

import { delay } from "../../tests/src";

import { wakuPeerExchangeDiscovery } from "./waku_peer_exchange_discovery";

describe.only("Peer Exchange Discovery", () => {
  let waku: Waku;

  afterEach(async function () {
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });
  it("connects to nwaku", async function () {
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

    while (true) {
      await waitForRemotePeer(waku, [Protocols.PeerExchange]);
      await delay(3000);
    }
  });
});
