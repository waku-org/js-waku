import { createDecoder } from "@waku/core";
import type { ContentTopicInfo, IMessage, LightNode } from "@waku/interfaces";
import { createLightNode, Protocols } from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  pubsubTopicToSingleShardInfo
} from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  NOISE_KEY_1,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

import {
  processQueriedMessages,
  runStoreNodes,
  sendMessages,
  sendMessagesAutosharding,
  TestDecoder,
  TestDecoder2,
  TestShardInfo,
  totalMsgs
} from "./utils.js";

describe("Waku Store, custom pubsub topic", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestShardInfo);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Generator, custom pubsub topic", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic
    );

    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      TestDecoder.pubsubTopic
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
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic
    );
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder2.contentTopic,
      TestDecoder2.pubsubTopic
    );

    const customMessages = await processQueriedMessages(
      waku,
      [TestDecoder],
      TestDecoder.pubsubTopic
    );
    expect(customMessages?.length).eq(totalMsgs);
    const result1 = customMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result1).to.not.eq(-1);

    const testMessages = await processQueriedMessages(
      waku,
      [TestDecoder2],
      TestDecoder2.pubsubTopic
    );
    expect(testMessages?.length).eq(totalMsgs);
    const result2 = testMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result2).to.not.eq(-1);
  });

  it("Generator, 2 nwaku nodes each with different pubsubtopics", async function () {
    this.timeout(10000);

    // Set up and start a new nwaku node with Default Pubsubtopic
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      store: true,
      pubsubTopic: [TestDecoder2.pubsubTopic],
      clusterId: TestShardInfo.clusterId,
      relay: true
    });
    await nwaku2.ensureSubscriptions([TestDecoder2.pubsubTopic]);

    const totalMsgs = 10;
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic
    );
    await sendMessages(
      nwaku2,
      totalMsgs,
      TestDecoder2.contentTopic,
      TestDecoder2.pubsubTopic
    );

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
        [TestDecoder],
        TestDecoder.pubsubTopic
      );
      testMessages = await processQueriedMessages(
        waku,
        [TestDecoder2],
        TestDecoder2.pubsubTopic
      );
    }
  });
});

describe("Waku Store (Autosharding), custom pubsub topic", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;

  const customContentTopic1 = "/waku/2/content/utf8";
  const customContentTopic2 = "/myapp/1/latest/proto";
  const clusterId = 5;
  const autoshardingPubsubTopic1 = contentTopicToPubsubTopic(
    customContentTopic1,
    clusterId
  );
  const autoshardingPubsubTopic2 = contentTopicToPubsubTopic(
    customContentTopic2,
    clusterId
  );
  const customDecoder1 = createDecoder(
    customContentTopic1,
    pubsubTopicToSingleShardInfo(autoshardingPubsubTopic1)
  );
  const customDecoder2 = createDecoder(
    customContentTopic2,
    pubsubTopicToSingleShardInfo(autoshardingPubsubTopic2)
  );
  const contentTopicInfoBothShards: ContentTopicInfo = {
    clusterId,
    contentTopics: [customContentTopic1, customContentTopic2]
  };

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, contentTopicInfoBothShards);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Generator, custom pubsub topic", async function () {
    await sendMessagesAutosharding(nwaku, totalMsgs, customContentTopic1);

    const messages = await processQueriedMessages(
      waku,
      [customDecoder1],
      autoshardingPubsubTopic1
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
    await sendMessagesAutosharding(nwaku, totalMsgs, customContentTopic1);
    await sendMessagesAutosharding(nwaku, totalMsgs, customContentTopic2);

    const customMessages = await processQueriedMessages(
      waku,
      [customDecoder1],
      autoshardingPubsubTopic1
    );
    expect(customMessages?.length).eq(totalMsgs);
    const result1 = customMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result1).to.not.eq(-1);

    const testMessages = await processQueriedMessages(
      waku,
      [customDecoder2],
      autoshardingPubsubTopic2
    );
    expect(testMessages?.length).eq(totalMsgs);
    const result2 = testMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result2).to.not.eq(-1);
  });

  it("Generator, 2 nwaku nodes each with different pubsubtopics", async function () {
    this.timeout(10000);

    // Set up and start a new nwaku node with Default Pubsubtopic
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      store: true,
      pubsubTopic: [autoshardingPubsubTopic2],
      contentTopic: [customContentTopic2],
      relay: true,
      clusterId
    });
    await nwaku2.ensureSubscriptionsAutosharding([customContentTopic2]);

    const totalMsgs = 10;
    await sendMessagesAutosharding(nwaku, totalMsgs, customContentTopic1);
    await sendMessagesAutosharding(nwaku2, totalMsgs, customContentTopic2);

    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      networkConfig: contentTopicInfoBothShards
    });
    await waku.start();

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
        [customDecoder1],
        autoshardingPubsubTopic1
      );
      testMessages = await processQueriedMessages(
        waku,
        [customDecoder2],
        autoshardingPubsubTopic2
      );
    }
  });
});

describe("Waku Store (named sharding), custom pubsub topic", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestShardInfo);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Generator, custom pubsub topic", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic
    );

    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      TestDecoder.pubsubTopic
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
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic
    );
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder2.contentTopic,
      TestDecoder2.pubsubTopic
    );

    const customMessages = await processQueriedMessages(
      waku,
      [TestDecoder],
      TestDecoder.pubsubTopic
    );
    expect(customMessages?.length).eq(totalMsgs);
    const result1 = customMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result1).to.not.eq(-1);

    const testMessages = await processQueriedMessages(
      waku,
      [TestDecoder2],
      TestDecoder2.pubsubTopic
    );
    expect(testMessages?.length).eq(totalMsgs);
    const result2 = testMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result2).to.not.eq(-1);
  });

  it("Generator, 2 nwaku nodes each with different pubsubtopics", async function () {
    this.timeout(10000);

    // Set up and start a new nwaku node with Default Pubsubtopic
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      store: true,
      pubsubTopic: [TestDecoder2.pubsubTopic],
      relay: true,
      clusterId: TestShardInfo.clusterId
    });
    await nwaku2.ensureSubscriptions([TestDecoder2.pubsubTopic]);

    const totalMsgs = 10;
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic
    );
    await sendMessages(
      nwaku2,
      totalMsgs,
      TestDecoder2.contentTopic,
      TestDecoder2.pubsubTopic
    );

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
        [TestDecoder],
        TestDecoder.pubsubTopic
      );
      testMessages = await processQueriedMessages(
        waku,
        [TestDecoder2],
        TestDecoder2.pubsubTopic
      );
    }
  });
});
