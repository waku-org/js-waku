import { bootstrap } from "@libp2p/bootstrap";
import {
  DnsNodeDiscovery,
  enrTree,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import type { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import { afterEachCustom, tearDownNodes } from "../../src/index.js";

describe("Peer Exchange", () => {
  describe("Auto Discovery", function () {
    let waku: LightNode;
    const predefinedNodes: string[] = [];

    afterEachCustom(this, async () => {
      await tearDownNodes([], waku);
    });

    it(`should discover peers other than used for bootstrapping`, async function () {
      this.timeout(50_000);

      const dns = await DnsNodeDiscovery.dnsOverHttp();
      const dnsEnrs = [];
      for await (const node of dns.getNextPeer([enrTree["SANDBOX"]])) {
        dnsEnrs.push(node);
      }
      const dnsPeerMultiaddrs = dnsEnrs
        .flatMap(
          (enr) => enr.peerInfo?.multiaddrs.map((ma) => ma.toString()) ?? []
        )
        .filter((ma) => ma.includes("wss"));

      const networkConfig = { clusterId: 2, numShardsInCluster: 0 };
      waku = await createLightNode({
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: dnsPeerMultiaddrs }),
            wakuPeerExchangeDiscovery()
          ]
        },
        networkConfig
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
