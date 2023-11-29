import { MetadataCodec } from "@waku/core";
import type { LightNode, ShardInfo } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { shardInfoToPubsubTopics } from "@waku/utils";
import { expect } from "chai";

import { tearDownNodes } from "../src/index.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";

describe("Metadata Protocol", () => {
  describe("Locally Run Nodes", () => {
    let waku: LightNode;
    let nwaku1: NimGoNode;
    const shardInfo: ShardInfo = {
      clusterId: 1,
      shards: [1]
    };

    beforeEach(function () {
      nwaku1 = new NimGoNode(makeLogFileName(this) + "1");
    });

    afterEach(async function () {
      this.timeout(15000);
      await tearDownNodes([nwaku1], waku);
    });

    it("interop", async function () {
      this.timeout(55_000);

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        clusterId: shardInfo.clusterId,
        pubsubTopic: shardInfoToPubsubTopics(shardInfo)
      });

      const nwaku1Ma = await nwaku1.getMultiaddrWithId();
      const nwaku1PeerId = await nwaku1.getPeerId();

      waku = await createLightNode({ shardInfo });
      await waku.start();
      await waku.libp2p.dialProtocol(nwaku1Ma, MetadataCodec);

      const shardInfoRes =
        await waku.libp2p.services.metadata?.query(nwaku1PeerId);
      expect(shardInfoRes).to.not.be.undefined;
      expect(shardInfoRes?.clusterId).to.equal(shardInfo.clusterId);
      expect(shardInfoRes?.shards).to.deep.equal(shardInfo.shards);
    });
  });
});
