import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { PeerExchangeCodec, PeerExchangeDiscovery } from "@waku/discovery";
import type { LightNode, ShardInfo } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { singleShardInfoToPubsubTopic } from "@waku/utils";

import {
  beforeEachCustom,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

const pubsubTopic = [singleShardInfoToPubsubTopic({ clusterId: 0, shard: 0 })];
const shardInfo: ShardInfo = { clusterId: 0, shards: [0] };

describe("Peer Exchange", function () {
  describe("Compliance Test", function () {
    this.timeout(100_000);

    let waku: LightNode;
    let nwaku1: ServiceNode;
    let nwaku2: ServiceNode;

    beforeEachCustom(this, async () => {
      nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
      nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true
      });
      const enr = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr
      });
    });

    tests({
      async setup() {
        waku = await createLightNode({ shardInfo });
        await waku.start();

        const nwaku2Ma = await nwaku2.getMultiaddrWithId();

        const peerExchange = new PeerExchangeDiscovery(
          waku.libp2p.components,
          pubsubTopic
        );

        peerExchange.addEventListener("waku:peer-exchange:started", (event) => {
          if (event.detail === true) {
            void waku.libp2p.dialProtocol(nwaku2Ma, PeerExchangeCodec);
          }
        });

        return peerExchange;
      },
      teardown: async () => {
        this.timeout(15000);
        await tearDownNodes([nwaku1, nwaku2], waku);
      }
    });
  });
});
