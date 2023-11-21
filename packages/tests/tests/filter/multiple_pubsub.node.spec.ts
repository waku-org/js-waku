import {
  createDecoder,
  createEncoder,
  DefaultPubsubTopic,
  waitForRemotePeer
} from "@waku/core";
import type { IFilterSubscription, LightNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  makeLogFileName,
  MessageCollector,
  NimGoNode,
  tearDownNodes
} from "../../src/index.js";

import {
  runNodes,
  TestContentTopic,
  TestDecoder,
  TestEncoder
} from "./utils.js";

describe("Waku Filter V2: Multiple PubsubTopics", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;
  const customPubsubTopic = "/waku/2/custom-dapp/proto";
  const customContentTopic = "/test/2/waku-filter";
  const newEncoder = createEncoder({
    pubsubTopic: customPubsubTopic,
    contentTopic: customContentTopic
  });
  const newDecoder = createDecoder(customContentTopic, customPubsubTopic);

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(this, [
      customPubsubTopic,
      DefaultPubsubTopic
    ]);
    subscription = await waku.filter.createSubscription(customPubsubTopic);
    messageCollector = new MessageCollector();
  });

  this.afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Subscribe and receive messages on custom pubsubtopic", async function () {
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic,
      expectedPubsubTopic: customPubsubTopic,
      expectedMessageText: "M1"
    });
  });

  it("Subscribe and receive messages on 2 different pubsubtopics", async function () {
    await subscription.subscribe([newDecoder], messageCollector.callback);

    // Subscribe from the same lightnode to the 2nd pubsubtopic
    const subscription2 =
      await waku.filter.createSubscription(DefaultPubsubTopic);

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([TestDecoder], messageCollector2.callback);

    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M1") });
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    expect(await messageCollector2.waitForMessages(1)).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic,
      expectedPubsubTopic: customPubsubTopic,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: DefaultPubsubTopic,
      expectedMessageText: "M2"
    });
  });

  it("Subscribe and receive messages from 2 nwaku nodes each with different pubsubtopics", async function () {
    await subscription.subscribe([newDecoder], messageCollector.callback);

    // Set up and start a new nwaku node with Default Pubsubtopic
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      topic: [DefaultPubsubTopic]
    });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    // Subscribe from the same lightnode to the new nwaku on the new pubsubtopic
    const subscription2 = await waku.filter.createSubscription(
      DefaultPubsubTopic,
      await nwaku2.getPeerId()
    );
    await nwaku2.ensureSubscriptions([DefaultPubsubTopic]);

    const messageCollector2 = new MessageCollector();

    await subscription2.subscribe([TestDecoder], messageCollector2.callback);

    // Making sure that messages are send and reveiced for both subscriptions
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic
      })) ||
      !(await messageCollector2.waitForMessages(1, {
        pubsubTopic: DefaultPubsubTopic
      }))
    ) {
      await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M1") });
      await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });
    }

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic,
      expectedPubsubTopic: customPubsubTopic,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: DefaultPubsubTopic,
      expectedMessageText: "M2"
    });
  });

  it("Should fail to subscribe with decoder with wrong pubsubTopic", async function () {
    // this subscription object is set up with the `customPubsubTopic` but we're passing it a Decoder with the `DefaultPubsubTopic`
    try {
      await subscription.subscribe([TestDecoder], messageCollector.callback);
    } catch (error) {
      expect((error as Error).message).to.include(
        "Pubsub topic not configured"
      );
    }
  });
});
