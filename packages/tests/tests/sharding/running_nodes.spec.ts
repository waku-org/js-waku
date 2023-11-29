import { LightNode, ShardInfo, SingleShardInfo } from "@waku/interfaces";
import { createEncoder, createLightNode, utf8ToBytes } from "@waku/sdk";
import { singleShardInfoToPubsubTopic } from "@waku/utils";
import { expect } from "chai";

import { tearDownNodes } from "../../src/index.js";
import { makeLogFileName } from "../../src/log_file.js";
import { NimGoNode } from "../../src/node/node.js";

const PubsubTopic1 = singleShardInfoToPubsubTopic({
  clusterId: 0,
  shard: 2
});
const PubsubTopic2 = singleShardInfoToPubsubTopic({
  clusterId: 0,
  shard: 3
});
const shardInfoFirstShard: ShardInfo = { clusterId: 0, shards: [2] };
const shardInfoBothShards: ShardInfo = { clusterId: 0, shards: [2, 3] };
const singleShardInfo1: SingleShardInfo = { clusterId: 0, shard: 2 };
const singleShardInfo2: SingleShardInfo = { clusterId: 0, shard: 3 };
const ContentTopic = "/waku/2/content/test.js";

describe("Static Sharding: Running Nodes", () => {
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15_000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.start({ store: true, lightpush: true, relay: true });
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes(nwaku, waku);
  });

  it("configure the node with multiple pubsub topics", async function () {
    this.timeout(15_000);
    waku = await createLightNode({
      shardInfo: shardInfoBothShards
    });

    const encoder1 = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicShardInfo: singleShardInfo1
    });

    const encoder2 = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicShardInfo: singleShardInfo2
    });

    const request1 = await waku.lightPush.send(encoder1, {
      payload: utf8ToBytes("Hello World")
    });

    const request2 = await waku.lightPush.send(encoder2, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request1.recipients.length).to.eq(0);
    expect(request2.recipients.length).to.eq(0);
  });

  it("using a protocol with unconfigured pubsub topic should fail", async function () {
    this.timeout(15_000);
    waku = await createLightNode({
      shardInfo: shardInfoFirstShard
    });

    // use a pubsub topic that is not configured
    const encoder = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicShardInfo: singleShardInfo2
    });

    try {
      await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });
      throw new Error("The request should've thrown an error");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `Pubsub topic ${PubsubTopic2} has not been configured on this instance. Configured topics are: ${PubsubTopic1}`
        )
      ) {
        throw err;
      }
    }
  });
});
