import { waitForRemotePeer } from "@waku/core";
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
  customContentTopic1,
  customContentTopic2,
  customDecoder1,
  customDecoder2,
  customShardedPubsubTopic1,
  customShardedPubsubTopic2,
  processQueriedMessages,
  sendMessages,
  shardInfo1,
  shardInfoBothShards,
  startAndConnectLightNode,
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
    await nwaku.start({
      store: true,
      pubsubTopic: [customShardedPubsubTopic1, customShardedPubsubTopic2],
      relay: true
    });
    await nwaku.ensureSubscriptions([
      customShardedPubsubTopic1,
      customShardedPubsubTopic2
    ]);
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Generator, custom pubsub topic", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      customContentTopic1,
      customShardedPubsubTopic1
    );
    waku = await startAndConnectLightNode(nwaku, [], shardInfo1);
    const messages = await processQueriedMessages(
      waku,
      [customDecoder1],
      customShardedPubsubTopic1
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
      customContentTopic1,
      customShardedPubsubTopic1
    );
    await sendMessages(
      nwaku,
      totalMsgs,
      customContentTopic2,
      customShardedPubsubTopic2
    );

    waku = await startAndConnectLightNode(nwaku, [], shardInfoBothShards);

    const customMessages = await processQueriedMessages(
      waku,
      [customDecoder1],
      customShardedPubsubTopic1
    );
    expect(customMessages?.length).eq(totalMsgs);
    const result1 = customMessages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result1).to.not.eq(-1);

    const testMessages = await processQueriedMessages(
      waku,
      [customDecoder2],
      customShardedPubsubTopic2
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
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      store: true,
      pubsubTopic: [customShardedPubsubTopic2],
      relay: true
    });
    await nwaku2.ensureSubscriptions([customShardedPubsubTopic2]);

    const totalMsgs = 10;
    await sendMessages(
      nwaku,
      totalMsgs,
      customContentTopic1,
      customShardedPubsubTopic1
    );
    await sendMessages(
      nwaku2,
      totalMsgs,
      customContentTopic2,
      customShardedPubsubTopic2
    );

    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      shardInfo: shardInfoBothShards
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
        [customDecoder1],
        customShardedPubsubTopic1
      );
      testMessages = await processQueriedMessages(
        waku,
        [customDecoder2],
        customShardedPubsubTopic2
      );
    }
  });
});
