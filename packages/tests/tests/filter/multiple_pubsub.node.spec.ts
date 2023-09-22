import {
  createDecoder,
  createEncoder,
  DefaultPubSubTopic,
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

describe("Waku Filter V2: Multiple PubSubtopics", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;
  const customPubSubTopic = "/waku/2/custom-dapp/proto";
  const customContentTopic = "/test/2/waku-filter";
  const newEncoder = createEncoder({
    pubSubTopic: customPubSubTopic,
    contentTopic: customContentTopic
  });
  const newDecoder = createDecoder(customContentTopic, customPubSubTopic);

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(this, [
      customPubSubTopic,
      DefaultPubSubTopic
    ]);
    subscription = await waku.filter.createSubscription(customPubSubTopic);
    messageCollector = new MessageCollector(
      customContentTopic,
      customPubSubTopic
    );

    await nwaku.ensureSubscriptions([customPubSubTopic]);
  });

  this.afterEach(async function () {
    tearDownNodes([nwaku, nwaku2], [waku]);
  });

  it("Subscribe and receive messages on custom pubsubtopic", async function () {
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(0)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic,
      expectedPubSubTopic: customPubSubTopic,
      expectedMessageText: "M1"
    });
  });

  it("Subscribe and receive messages from 2 nwaku nodes on 2 different pubsubtopics", async function () {
    await subscription.subscribe([newDecoder], messageCollector.callback);
    await waku.lightPush.send(newEncoder, { payload: utf8ToBytes("M1") });

    // Set up and start a new nwaku node with a different pubSubtopic
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({ filter: true, lightpush: true, relay: true });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);

    // Subscribe from the same lightnode to the new nwaku on the new pubSubtopic
    const subscription2 = await waku.filter.createSubscription(
      DefaultPubSubTopic,
      await nwaku2.getPeerId()
    );
    await nwaku.ensureSubscriptions([DefaultPubSubTopic]);

    // Send a message using the new subscription
    const messageCollector2 = new MessageCollector(
      TestContentTopic,
      DefaultPubSubTopic
    );

    await subscription2.subscribe([TestDecoder], messageCollector2.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Check that both messages were correctly send on coresponding pubSubtopics
    expect(await messageCollector.waitForMessages(0)).to.eq(true);
    expect(await messageCollector2.waitForMessages(1)).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedContentTopic: customContentTopic,
      expectedPubSubTopic: customPubSubTopic,
      expectedMessageText: "M1"
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedContentTopic: TestContentTopic,
      expectedPubSubTopic: DefaultPubSubTopic,
      expectedMessageText: "M2"
    });
  });
});
