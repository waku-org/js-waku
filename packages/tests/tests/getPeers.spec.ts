import { MetadataCodec } from "@waku/core";
import { createLightNode, type LightNode, ShardInfo } from "@waku/sdk";
import { shardInfoToPubsubTopics } from "@waku/utils";
import { getPeersForProtocolAndShard } from "@waku/utils/libp2p";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";
import { tearDownNodes } from "../src/teardown.js";

describe("getPeersForProtocolAndShard", function () {
  let waku: LightNode;
  let serviceNode: NimGoNode;

  const shardInfo: ShardInfo = {
    clusterId: 1,
    shards: [1, 2, 3]
  };

  this.beforeEach(async function () {
    this.timeout(15000);
    serviceNode = new NimGoNode(makeLogFileName(this) + "1");
    await serviceNode.start({
      discv5Discovery: true,
      peerExchange: true,
      clusterId: shardInfo.clusterId,
      pubsubTopic: shardInfoToPubsubTopics(shardInfo)
    });
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([serviceNode], waku);
  });

  it("same cluster id: nodes connect", async function () {
    this.timeout(15000);

    const serviceNodeMa = await serviceNode.getMultiaddrWithId();

    waku = await createLightNode({ shardInfo });
    await waku.start();
    await waku.libp2p.dialProtocol(serviceNodeMa, MetadataCodec);
    //TODO: remove delay
    await delay(100);
    const peers = await getPeersForProtocolAndShard(
      waku.libp2p.peerStore,
      waku.libp2p.getProtocols(),
      shardInfo
    );
    expect(peers).length.to.be.greaterThan(0);
  });
});
