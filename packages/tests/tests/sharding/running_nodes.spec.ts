import { LightNode, ShardInfo, SingleTopicShardInfo } from "@waku/interfaces";
import { createEncoder, createLightNode, utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import { tearDownNodes } from "../../src/index.js";
import { makeLogFileName } from "../../src/log_file.js";
import { NimGoNode } from "../../src/node/node.js";

const PubsubTopic1 = "/waku/2/rs/0/2";
const PubsubTopic2 = "/waku/2/rs/0/3";
const shardInfoFirstShard: ShardInfo = { cluster: 0, indexList: [2] };
const shardInfoBothShards: ShardInfo = { cluster: 0, indexList: [2, 3] };
const singleTopicShardInfo1: SingleTopicShardInfo = { cluster: 0, index: 2 };
const singleTopicShardInfo2: SingleTopicShardInfo = { cluster: 0, index: 3 };
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
      pubsubTopic: singleTopicShardInfo1
    });

    const encoder2 = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopic: singleTopicShardInfo2
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
      pubsubTopic: singleTopicShardInfo2
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
