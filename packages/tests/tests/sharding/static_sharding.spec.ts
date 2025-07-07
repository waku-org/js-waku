import { LightNode, ProtocolError } from "@waku/interfaces";
import { createEncoder, createLightNode, utf8ToBytes } from "@waku/sdk";
import {
  determinePubsubTopic,
  shardInfoToPubsubTopics,
  singleShardInfosToShardInfo
} from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

const ContentTopic = "/waku/2/content/test.js";

describe("Static Sharding: Running Nodes", function () {
  this.timeout(15_000);
  const numServiceNodes = 2;

  let waku: LightNode | undefined = undefined;
  let serviceNodes: ServiceNodesFleet | undefined = undefined;

  afterEachCustom(this, async () => {
    if (serviceNodes) {
      await teardownNodesWithRedundancy(serviceNodes, waku ?? []);
    }
  });

  it("shard 0", async function () {
    const shard = 0;
    const clusterId = 0;
    const singleShardInfo = { clusterId, shard };
    const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      shardInfo,
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicOrShard: shard
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: determinePubsubTopic(ContentTopic, clusterId)
      })
    ).to.eq(true);
  });

  // dedicated test for Default Cluster ID 0
  it("Cluster ID 0 - Default/Global Cluster", async function () {
    const shard = 1;
    const singleShardInfo = { clusterId: 0, shard };
    const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      shardInfo,
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicOrShard: shard
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: shardInfoToPubsubTopics(shardInfo)[0]
      })
    ).to.eq(true);
  });

  const numTest = 10;
  for (let i = 0; i < numTest; i++) {
    // Random clusterId between 2 and 1000
    const clusterId = Math.floor(Math.random() * 999) + 2;

    // Random shardId between 1 and 1000
    const shardId = Math.floor(Math.random() * 1000) + 1;

    it(`random static sharding ${
      i + 1
    } - Cluster ID: ${clusterId}, Shard ID: ${shardId}`, async function () {
      const singleShardInfo = { clusterId: clusterId, shard: shardId };
      const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);

      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        shardInfo,
        { lightpush: true, filter: true },
        false,
        numServiceNodes,
        true
      );

      const encoder = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopicOrShard: shardId
      });

      const request = await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      expect(request.successes.length).to.eq(numServiceNodes);
      expect(
        await serviceNodes.messageCollector.waitForMessages(1, {
          pubsubTopic: shardInfoToPubsubTopics(shardInfo)[0]
        })
      ).to.eq(true);
    });
  }

  describe("Others", function () {
    const clusterId = 2;
    const shard1 = 2;
    const shard2 = 3;

    beforeEachCustom(this, async () => {
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        { clusterId, shards: [2, 3] },
        { lightpush: true, filter: true },
        false,
        numServiceNodes,
        true
      );
    });

    afterEachCustom(this, async () => {
      if (serviceNodes) {
        await teardownNodesWithRedundancy(serviceNodes, waku ?? []);
      }
    });

    it("configure the node with multiple pubsub topics", async function () {
      const encoder1 = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopicOrShard: shard1
      });

      const encoder2 = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopicOrShard: shard2
      });

      const request1 = await waku?.lightPush.send(encoder1, {
        payload: utf8ToBytes("Hello World2")
      });

      expect(request1?.successes.length).to.eq(numServiceNodes);
      expect(
        await serviceNodes?.messageCollector.waitForMessages(1, {
          pubsubTopic: determinePubsubTopic(encoder1.contentTopic, clusterId)
        })
      ).to.eq(true);

      const request2 = await waku?.lightPush.send(encoder2, {
        payload: utf8ToBytes("Hello World3")
      });

      expect(request2?.successes.length).to.eq(numServiceNodes);
      expect(
        await serviceNodes?.messageCollector.waitForMessages(1, {
          pubsubTopic: determinePubsubTopic(encoder2.contentTopic, clusterId)
        })
      ).to.eq(true);
    });

    it("using a protocol with unconfigured pubsub topic should fail", async function () {
      this.timeout(15_000);

      // use a pubsub topic that is not configured
      const encoder = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopicOrShard: 4
      });

      const request = await waku?.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      if (
        (request?.successes.length || 0) > 0 ||
        request?.failures?.length === 0
      ) {
        throw new Error("The request should've thrown an error");
      }

      const errors = request?.failures?.map((failure) => failure.error);
      expect(errors).to.include(ProtocolError.TOPIC_NOT_CONFIGURED);
    });

    it("start node with empty shard should fail", async function () {
      try {
        waku = await createLightNode({
          networkConfig: { clusterId: clusterId, shards: [] }
        });
        throw new Error(
          "Starting the node with no shard should've thrown an error"
        );
      } catch (err) {
        if (
          !(err instanceof Error) ||
          !err.message.includes(
            "Invalid shards configuration: please provide at least one shard"
          )
        ) {
          throw err;
        }
      }
    });
  });
});
