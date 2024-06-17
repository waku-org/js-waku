import { bootstrap } from "@libp2p/bootstrap";
import {
  DnsNodeDiscovery,
  enrTree,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import type { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import {
  singleShardInfosToShardInfo,
  singleShardInfoToPubsubTopic
} from "@waku/utils";
import { expect } from "chai";

import { afterEachCustom, tearDownNodes } from "../../src";

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
      const dnsEnrs = await dns.getPeers(
        [enrTree["SANDBOX"], enrTree["TEST"]],
        {
          lightPush: 1
        }
      );
      const dnsPeerMultiaddrs = dnsEnrs
        .flatMap(
          (enr) => enr.peerInfo?.multiaddrs.map((ma) => ma.toString()) ?? []
        )
        .filter((ma) => ma.includes("wss"));

      const singleShardInfo = { clusterId: 1, shard: 1 };
      const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);
      const pubsubTopic = singleShardInfoToPubsubTopic(singleShardInfo);
      waku = await createLightNode({
        libp2p: {
          peerDiscovery: [
            bootstrap({ list: dnsPeerMultiaddrs }),
            wakuPeerExchangeDiscovery([pubsubTopic])
          ]
        },
        shardInfo: shardInfo
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
