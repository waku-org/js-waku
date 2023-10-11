import { DefaultPubSubTopic, waitForRemotePeer } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { createLightNode, Protocols } from "@waku/sdk";
import { expect } from "chai";

import {
  makeLogFileName,
  NimGoNode,
  NOISE_KEY_1,
  tearDownNodes
} from "../../src/index.js";

import {
  customContentTopic,
  customPubSubTopic,
  customTestDecoder,
  processQueriedMessages,
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder,
  totalMsgs
} from "./utils.js";

describe("Waku Store, custom pubsub topic", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.startWithRetries({
      store: true,
      topic: [customPubSubTopic, DefaultPubSubTopic],
      relay: true
    });
    await nwaku.ensureSubscriptions([customPubSubTopic, DefaultPubSubTopic]);
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Generator, custom pubsub topic", async function () {
    await sendMessages(nwaku, totalMsgs, customContentTopic, customPubSubTopic);
    waku = await startAndConnectLightNode(nwaku, [customPubSubTopic]);
    const messages = await processQueriedMessages(
      waku,
      [customTestDecoder],
      customPubSubTopic
    );

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result).to.not.eq(-1);
  });

  it("Generator, 2 different pubsubtopics", async function () {
    this.timeout(10000);

    const totalMsgs = 10;
    await sendMessages(nwaku, totalMsgs, customContentTopic, customPubSubTopic);
    await sendMessages(nwaku, totalMsgs, TestContentTopic, DefaultPubSubTopic);

    waku = await startAndConnectLightNode(nwaku, [
      customPubSubTopic,
      DefaultPubSubTopic
    ]);

    const customMessages = await processQueriedMessages(
      waku,
      [customTestDecoder],
      customPubSubTopic
    );
    expect(customMessages?.length).eq(totalMsgs);
    const result1 = customMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result1).to.not.eq(-1);

    const testMessages = await processQueriedMessages(
      waku,
      [TestDecoder],
      DefaultPubSubTopic
    );
    expect(testMessages?.length).eq(totalMsgs);
    const result2 = testMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result2).to.not.eq(-1);
  });

  it("Generator, 2 nwaku nodes each with different pubsubtopics", async function () {
    this.timeout(10000);

    // Set up and start a new nwaku node with Default PubSubtopic
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.startWithRetries({
      store: true,
      topic: [DefaultPubSubTopic],
      relay: true
    });
    await nwaku2.ensureSubscriptions([DefaultPubSubTopic]);

    const totalMsgs = 10;
    await sendMessages(nwaku, totalMsgs, customContentTopic, customPubSubTopic);
    await sendMessages(nwaku2, totalMsgs, TestContentTopic, DefaultPubSubTopic);

    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      pubSubTopics: [customPubSubTopic, DefaultPubSubTopic]
    });
    await waku.start();

    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    let customMessages: IMessage[] = [];
    let testMessages: IMessage[] = [];

    while (
      customMessages.length != totalMsgs ||
      testMessages.length != totalMsgs
    ) {
      customMessages = await processQueriedMessages(
        waku,
        [customTestDecoder],
        customPubSubTopic
      );
      testMessages = await processQueriedMessages(
        waku,
        [TestDecoder],
        DefaultPubSubTopic
      );
    }
  });
});
