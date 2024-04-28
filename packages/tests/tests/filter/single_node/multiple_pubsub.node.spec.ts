import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import type {
  ContentTopicInfo,
  IFilterSubscription,
  LightNode,
  ShardInfo,
  SingleShardInfo
} from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import {
  contentTopicToPubsubTopic,
  contentTopicToShardIndex,
  singleShardInfoToPubsubTopic
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  MessageCollector,
  ServiceNode,
  tearDownNodes
} from "../../../src/index.js";

import { runNodes } from "./utils.js";

describe("Waku Filter V2: Multiple PubsubTopics", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;

  const customPubsubTopic1 = singleShardInfoToPubsubTopic({
    clusterId: 3,
    shard: 1
  });
  const customPubsubTopic2 = singleShardInfoToPubsubTopic({
    clusterId: 3,
    shard: 2
  });
  const shardInfo: ShardInfo = { clusterId: 3, shards: [1, 2] };
  const singleShardInfo1: SingleShardInfo = { clusterId: 3, shard: 1 };
  const singleShardInfo2: SingleShardInfo = { clusterId: 3, shard: 2 };
  const customContentTopic1 = "/test/2/waku-filter";
  const customContentTopic2 = "/test/3/waku-filter";
  const customEncoder1 = createEncoder({
    pubsubTopicShardInfo: singleShardInfo1,
    contentTopic: customContentTopic1
  });
  const customDecoder1 = createDecoder(customContentTopic1, singleShardInfo1);
  const customEncoder2 = createEncoder({
    pubsubTopicShardInfo: singleShardInfo2,
    contentTopic: customContentTopic2
  });
  const customDecoder2 = createDecoder(customContentTopic2, singleShardInfo2);

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, shardInfo);
    subscription = await waku.filter.createSubscription(shardInfo);
    messageCollector = new MessageCollector();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Subscribe and receive messages on custom pubsubtopic", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);
    await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1,
      expectedMessageText: "M1"
    });
  });

  it("Subscribe and receive messages on 2 different pubsubtopics", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);

    // Subscribe from the same lightnode to the 2nd pubsubtopic
    const subscription2 =
      await waku.filter.createSubscription(customPubsubTopic2);

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([customDecoder2], messageCollector2.callback);

    await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(customEncoder2, { payload: utf8ToBytes("M2") });

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    expect(await messageCollector2.waitForMessages(1)).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: customPubsubTopic2,
      expectedMessageText: "M2"
    });
  });

  it("Subscribe and receive messages from 2 nwaku nodes each with different pubsubtopics", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);

    // Set up and start a new nwaku node with customPubsubTopic1
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: [customPubsubTopic2],
      clusterId: 3
    });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    // Subscribe from the same lightnode to the new nwaku on the new pubsubtopic
    const subscription2 =
      await waku.filter.createSubscription(customPubsubTopic2);
    await nwaku2.ensureSubscriptions([customPubsubTopic2]);

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([customDecoder2], messageCollector2.callback);

    // Making sure that messages are send and reveiced for both subscriptions
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic1
      })) ||
      !(await messageCollector2.waitForMessages(1, {
        pubsubTopic: customPubsubTopic2
      }))
    ) {
      await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(customEncoder2, { payload: utf8ToBytes("M2") });
    }

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: customPubsubTopic2,
      expectedMessageText: "M2"
    });
  });

  it("Should fail to subscribe with decoder with wrong pubsubTopic", async function () {
    // this subscription object is set up with the `customPubsubTopic1` but we're passing it a Decoder with the `customPubsubTopic2`
    try {
      await subscription.subscribe([customDecoder2], messageCollector.callback);
    } catch (error) {
      expect((error as Error).message).to.include(
        "Pubsub topic not configured"
      );
    }
  });
});

describe("Waku Filter V2 (Autosharding): Multiple PubsubTopics", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(30000);
  const clusterId = 3;
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;

  const customContentTopic1 = "/waku/2/content/utf8";
  const customContentTopic2 = "/myapp/1/latest/proto";
  const autoshardingPubsubTopic1 = contentTopicToPubsubTopic(
    customContentTopic1,
    clusterId
  );
  const autoshardingPubsubTopic2 = contentTopicToPubsubTopic(
    customContentTopic2,
    clusterId
  );
  const contentTopicInfo: ContentTopicInfo = {
    clusterId: clusterId,
    contentTopics: [customContentTopic1, customContentTopic2]
  };
  const customEncoder1 = createEncoder({
    contentTopic: customContentTopic1,
    pubsubTopicShardInfo: {
      clusterId: clusterId,
      shard: contentTopicToShardIndex(customContentTopic1)
    }
  });
  const customDecoder1 = createDecoder(customContentTopic1, {
    clusterId: clusterId,
    shard: contentTopicToShardIndex(customContentTopic1)
  });
  const customEncoder2 = createEncoder({
    contentTopic: customContentTopic2,
    pubsubTopicShardInfo: {
      clusterId: clusterId,
      shard: contentTopicToShardIndex(customContentTopic2)
    }
  });
  const customDecoder2 = createDecoder(customContentTopic2, {
    clusterId: clusterId,
    shard: contentTopicToShardIndex(customContentTopic2)
  });

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, contentTopicInfo);
    subscription = await waku.filter.createSubscription(
      autoshardingPubsubTopic1
    );
    messageCollector = new MessageCollector();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Subscribe and receive messages on autosharded pubsubtopic", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);
    await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
    expect(
      await messageCollector.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic1
      })
    ).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: autoshardingPubsubTopic1,
      expectedMessageText: "M1"
    });
  });

  it("Subscribe and receive messages on 2 different pubsubtopics", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);

    // Subscribe from the same lightnode to the 2nd pubsubtopic
    const subscription2 = await waku.filter.createSubscription(
      autoshardingPubsubTopic2
    );

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([customDecoder2], messageCollector2.callback);

    await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(customEncoder2, { payload: utf8ToBytes("M2") });

    expect(
      await messageCollector.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic1
      })
    ).to.eq(true);
    expect(
      await messageCollector2.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic2
      })
    ).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: autoshardingPubsubTopic1,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: autoshardingPubsubTopic2,
      expectedMessageText: "M2"
    });
  });

  it("Subscribe and receive messages from 2 nwaku nodes each with different pubsubtopics", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);

    // Set up and start a new nwaku node with customPubsubTopic1
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: [autoshardingPubsubTopic2],
      clusterId: clusterId,
      contentTopic: [customContentTopic2]
    });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    // Subscribe from the same lightnode to the new nwaku on the new pubsubtopic
    const subscription2 = await waku.filter.createSubscription(
      autoshardingPubsubTopic2
    );
    await nwaku2.ensureSubscriptionsAutosharding([customContentTopic2]);

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([customDecoder2], messageCollector2.callback);

    // Making sure that messages are send and reveiced for both subscriptions
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic1
      })) ||
      !(await messageCollector2.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic2
      }))
    ) {
      await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(customEncoder2, { payload: utf8ToBytes("M2") });
    }

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: autoshardingPubsubTopic1,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: autoshardingPubsubTopic2,
      expectedMessageText: "M2"
    });
  });

  it("Should fail to subscribe with decoder with wrong pubsubTopic", async function () {
    // this subscription object is set up with the `customPubsubTopic1` but we're passing it a Decoder with the `customPubsubTopic2`
    try {
      await subscription.subscribe([customDecoder2], messageCollector.callback);
    } catch (error) {
      expect((error as Error).message).to.include(
        "Pubsub topic not configured"
      );
    }
  });
});

describe("Waku Filter V2 (Named sharding): Multiple PubsubTopics", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;

  const customPubsubTopic1 = singleShardInfoToPubsubTopic({
    clusterId: 3,
    shard: 1
  });
  const customPubsubTopic2 = singleShardInfoToPubsubTopic({
    clusterId: 3,
    shard: 2
  });
  const shardInfo = {
    clusterId: 3,
    shards: [1, 2]
  };
  const customContentTopic1 = "/test/2/waku-filter";
  const customContentTopic2 = "/test/3/waku-filter";
  const customEncoder1 = createEncoder({
    pubsubTopic: customPubsubTopic1,
    contentTopic: customContentTopic1
  });
  const customDecoder1 = createDecoder(customContentTopic1, customPubsubTopic1);
  const customEncoder2 = createEncoder({
    pubsubTopic: customPubsubTopic2,
    contentTopic: customContentTopic2
  });
  const customDecoder2 = createDecoder(customContentTopic2, customPubsubTopic2);

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, shardInfo);
    subscription = await waku.filter.createSubscription(customPubsubTopic1);
    messageCollector = new MessageCollector();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Subscribe and receive messages on custom pubsubtopic", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);
    await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1,
      expectedMessageText: "M1"
    });
  });

  it("Subscribe and receive messages on 2 different pubsubtopics", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);

    // Subscribe from the same lightnode to the 2nd pubsubtopic
    const subscription2 =
      await waku.filter.createSubscription(customPubsubTopic2);

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([customDecoder2], messageCollector2.callback);

    await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(customEncoder2, { payload: utf8ToBytes("M2") });

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    expect(await messageCollector2.waitForMessages(1)).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: customPubsubTopic2,
      expectedMessageText: "M2"
    });
  });

  it("Subscribe and receive messages from 2 nwaku nodes each with different pubsubtopics", async function () {
    await subscription.subscribe([customDecoder1], messageCollector.callback);

    // Set up and start a new nwaku node with customPubsubTopic1
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: [customPubsubTopic2],
      clusterId: 3
    });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    // Subscribe from the same lightnode to the new nwaku on the new pubsubtopic
    const subscription2 =
      await waku.filter.createSubscription(customPubsubTopic2);
    await nwaku2.ensureSubscriptions([customPubsubTopic2]);

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([customDecoder2], messageCollector2.callback);

    // Making sure that messages are send and reveiced for both subscriptions
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic1
      })) ||
      !(await messageCollector2.waitForMessages(1, {
        pubsubTopic: customPubsubTopic2
      }))
    ) {
      await waku.lightPush.send(customEncoder1, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(customEncoder2, { payload: utf8ToBytes("M2") });
    }

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: customPubsubTopic2,
      expectedMessageText: "M2"
    });
  });

  it("Should fail to subscribe with decoder with wrong pubsubTopic", async function () {
    // this subscription object is set up with the `customPubsubTopic1` but we're passing it a Decoder with the `customPubsubTopic2`
    try {
      await subscription.subscribe([customDecoder2], messageCollector.callback);
    } catch (error) {
      expect((error as Error).message).to.include(
        "Pubsub topic not configured"
      );
    }
  });
});
