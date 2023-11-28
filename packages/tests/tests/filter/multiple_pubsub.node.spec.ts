import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import type {
  IFilterSubscription,
  LightNode,
  ShardInfo,
  SingleShardInfo
} from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import {
  pubsubTopicToSingleShardInfo,
  singleShardInfoToPubsubTopic
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  makeLogFileName,
  MessageCollector,
  NimGoNode,
  tearDownNodes
} from "../../src/index.js";

import { runNodes } from "./utils.js";

describe("Waku Filter V2: Multiple PubsubTopics", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;

  const customPubsubTopic1 = singleShardInfoToPubsubTopic({
    cluster: 3,
    index: 1
  });
  const customPubsubTopic2 = singleShardInfoToPubsubTopic({
    cluster: 3,
    index: 2
  });
  const shardInfo: ShardInfo = { cluster: 3, indexList: [1, 2] };
  const singleShardInfo1: SingleShardInfo = { cluster: 3, index: 1 };
  const singleShardInfo2: SingleShardInfo = { cluster: 3, index: 2 };
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

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(
      this,
      [customPubsubTopic1, customPubsubTopic2],
      shardInfo
    );
    subscription = await waku.filter.createSubscription(
      pubsubTopicToSingleShardInfo(customPubsubTopic1)
    );
    messageCollector = new MessageCollector();
  });

  this.afterEach(async function () {
    this.timeout(15000);
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
    const subscription2 = await waku.filter.createSubscription(
      pubsubTopicToSingleShardInfo(customPubsubTopic2)
    );

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
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: [customPubsubTopic2]
    });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    // Subscribe from the same lightnode to the new nwaku on the new pubsubtopic
    const subscription2 = await waku.filter.createSubscription(
      pubsubTopicToSingleShardInfo(customPubsubTopic2),
      await nwaku2.getPeerId()
    );
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
    // this subscription object is set up with the `customPubsubTopic` but we're passing it a Decoder with the `DefaultPubsubTopic`
    try {
      await subscription.subscribe([customDecoder2], messageCollector.callback);
    } catch (error) {
      expect((error as Error).message).to.include(
        "Pubsub topic not configured"
      );
    }
  });
});
