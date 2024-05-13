import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { PeerExchangeCodec, PeerExchangeDiscovery } from "@waku/discovery";
import type { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { singleShardInfoToPubsubTopic } from "@waku/utils";

import {
  beforeEachCustom,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

const pubsubTopic = [singleShardInfoToPubsubTopic({ clusterId: 0, shard: 2 })];

describe("Peer Exchange", function () {
  describe("Compliance Test", function () {
    this.timeout(100_000);

    let waku: LightNode;
    let nwaku1: ServiceNode;
    let nwaku2: ServiceNode;

    beforeEachCustom(this, async () => {
      nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
      nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
    });

    tests({
      async setup() {
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

        waku = await createLightNode();
        await waku.start();

        const nwaku2Ma = await nwaku2.getMultiaddrWithId();

        // we do this because we want peer-exchange discovery to get initialised before we dial the peer which contains info about the other peer
        setTimeout(() => {
          void waku.libp2p.dialProtocol(nwaku2Ma, PeerExchangeCodec);
        }, 5000);

        return new PeerExchangeDiscovery(waku.libp2p.components, pubsubTopic);
      },
      teardown: async () => {
        this.timeout(15000);
        await tearDownNodes([nwaku1, nwaku2], waku);
      }
    });
  });
});
