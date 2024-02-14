import { bootstrap } from "@libp2p/bootstrap";
import {
  Fleet,
  getPredefinedBootstrapNodes
} from "@waku/core/lib/predefined_bootstrap_nodes";
import type { LightNode } from "@waku/interfaces";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
import { createLightNode, DefaultPubsubTopic } from "@waku/sdk";
import { expect } from "chai";

import { afterEachCustom, tearDownNodes } from "../src";

describe("Peer Exchange", () => {
  describe("Auto Discovery", function () {
    let waku: LightNode;

    afterEachCustom(this, async () => {
      await tearDownNodes([], waku);
    });

    const testCases: [Fleet, number][] = [
      [Fleet.Test, 2], // on test fleet there are only 3 peers
      [Fleet.Prod, 3]
    ];

    testCases.map(([name, nodes]) => {
      it(`should discover peers other than used for bootstrapping on ${name} fleet`, async function () {
        this.timeout(50_000);
        const predefinedNodes = getPredefinedBootstrapNodes(name, nodes);

        waku = await createLightNode({
          libp2p: {
            peerDiscovery: [
              bootstrap({ list: predefinedNodes }),
              wakuPeerExchangeDiscovery([DefaultPubsubTopic])
            ]
          }
        });

        await waku.start();

        const foundPxPeer = await new Promise<boolean>((resolve) => {
          waku.libp2p.addEventListener("peer:discovery", (evt) => {
            const peerId = evt.detail.id.toString();
            const isBootstrapNode = predefinedNodes.find((n) =>
              n.includes(peerId)
            );
            if (!isBootstrapNode) {
              resolve(true);
            }
          });
        });

        expect(foundPxPeer).to.be.true;
      });
    });
  });
});
