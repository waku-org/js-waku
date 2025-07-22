import { createDecoder } from "@waku/core";
import { IMessage, LightNode, ShardId, StaticSharding } from "@waku/interfaces";
import { Protocols } from "@waku/sdk";
import { createRoutingInfo, RoutingInfo } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

import {
  processQueriedMessages,
  runStoreNodes,
  sendMessages,
  totalMsgs
} from "./utils.js";

const StaticTestClusterId = 2;
const StaticTestRelayShards = [1, 2];
const StaticTestNetworkConfig: StaticSharding = {
  clusterId: StaticTestClusterId
};

const TestShardOne: ShardId = 1;
const TestContentTopicOne = "/test/0/one/proto";
const TestRoutingInfoOne = createRoutingInfo(StaticTestNetworkConfig, {
  shardId: TestShardOne
});

const TestDecoderShardOne = createDecoder(
  TestContentTopicOne,
  TestRoutingInfoOne
);

const TestShardTwo: ShardId = 2;
const TestContentTopicTwo = "/test/0/two/proto";
const TestRoutingInfoTwo = createRoutingInfo(StaticTestNetworkConfig, {
  shardId: TestShardTwo
});

const TestDecoderShardTwo = createDecoder(
  TestContentTopicTwo,
  TestRoutingInfoTwo
);

// TODO: Same tests but with auto-sharding
describe("Waku Store, different static shards", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(
      this.ctx,
      StaticTestNetworkConfig,
      StaticTestRelayShards
    );
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Generator, one shard", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      TestContentTopicOne,
      TestRoutingInfoOne
    );

    const messages = await processQueriedMessages(
      waku,
      [TestDecoderShardOne],
      TestDecoderShardOne.routingInfo.pubsubTopic
    );

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result).to.not.eq(-1);
  });

  it("Generator, 2 different shards", async function () {
    this.timeout(10000);

    const totalMsgs = 10;
    await sendMessages(
      nwaku,
      totalMsgs,
      TestContentTopicOne,
      TestRoutingInfoOne
    );
    await sendMessages(
      nwaku,
      totalMsgs,
      TestContentTopicTwo,
      TestRoutingInfoTwo
    );

    const customMessages = await processQueriedMessages(
      waku,
      [TestDecoderShardOne],
      TestDecoderShardOne.routingInfo.pubsubTopic
    );
    expect(customMessages?.length).eq(totalMsgs);
    const result1 = customMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result1).to.not.eq(-1);

    const testMessages = await processQueriedMessages(
      waku,
      [TestDecoderShardTwo],
      TestDecoderShardTwo.routingInfo.pubsubTopic
    );
    expect(testMessages?.length).eq(totalMsgs);
    const result2 = testMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result2).to.not.eq(-1);
  });

  it("Generator, 2 nwaku nodes each with different shards", async function () {
    this.timeout(10000);

    await tearDownNodes([nwaku], []);

    // make sure each nwaku node operates on dedicated shard only
    nwaku = new ServiceNode(makeLogFileName(this) + "1");
    await nwaku.start({
      store: true,
      clusterId: StaticTestClusterId,
      shard: [1],
      relay: true,
      numShardsInNetwork: 0 // static sharding
    });

    // Set up and start a new nwaku node with Default Pubsubtopic
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      store: true,
      clusterId: StaticTestClusterId,
      shard: [2],
      relay: true,
      numShardsInNetwork: 0 // static sharding
    });

    const totalMsgs = 10;
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoderShardOne.contentTopic,
      TestDecoderShardOne.routingInfo as RoutingInfo
    );
    await sendMessages(
      nwaku2,
      totalMsgs,
      TestDecoderShardTwo.contentTopic,
      TestDecoderShardTwo.routingInfo as RoutingInfo
    );

    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waku.waitForPeers([Protocols.Store]);

    let customMessages: IMessage[] = [];
    let testMessages: IMessage[] = [];

    while (
      customMessages.length != totalMsgs ||
      testMessages.length != totalMsgs
    ) {
      customMessages = await processQueriedMessages(
        waku,
        [TestDecoderShardOne],
        TestDecoderShardOne.routingInfo.pubsubTopic
      );
      testMessages = await processQueriedMessages(
        waku,
        [TestDecoderShardTwo],
        TestDecoderShardTwo.routingInfo.pubsubTopic
      );
    }
  });
});
