import {
  LightNode,
  Protocols,
  ShardInfo,
  SingleShardInfo
} from "@waku/interfaces";
import {
  createEncoder,
  createLightNode,
  utf8ToBytes,
  waitForRemotePeer
} from "@waku/sdk";
import {
  contentTopicToShardIndex,
  singleShardInfoToPubsubTopic
} from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

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
const ContentTopic2 = "/myapp/1/latest/proto";

describe("Static Sharding: Running Nodes", function () {
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    nwaku = new ServiceNode(makeLogFileName(this.ctx));
    await nwaku.start({ store: true, lightpush: true, relay: true });
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  it("configure the node with multiple pubsub topics", async function () {
    this.timeout(15_000);
    waku = await createLightNode({
      shardInfo: shardInfoBothShards
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

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

    expect(request1.recipients.length).to.eq(1);
    expect(request2.recipients.length).to.eq(1);
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

describe("Autosharding: Running Nodes", function () {
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    nwaku = new ServiceNode(makeLogFileName(this.ctx));
    await nwaku.start({ store: true, lightpush: true, relay: true });
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  it("configure the node with multiple pubsub topics", async function () {
    this.timeout(15_000);
    waku = await createLightNode({
      shardInfo: {
        clusterId: 0,
        // For autosharding, we configure multiple pubsub topics by using two content topics that hash to different shards
        contentTopics: [ContentTopic, ContentTopic2]
      }
    });
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const encoder1 = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicShardInfo: {
        clusterId: 0,
        shard: contentTopicToShardIndex(ContentTopic)
      }
    });

    const encoder2 = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicShardInfo: {
        clusterId: 0,
        shard: contentTopicToShardIndex(ContentTopic2)
      }
    });

    const request1 = await waku.lightPush.send(encoder1, {
      payload: utf8ToBytes("Hello World")
    });

    const request2 = await waku.lightPush.send(encoder2, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request1.recipients.length).to.eq(1);
    expect(request2.recipients.length).to.eq(1);
  });
});
