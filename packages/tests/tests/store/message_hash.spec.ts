import type { IDecodedMessage, LightNode } from "@waku/interfaces";
import { messageHash } from "@waku/message-hash";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

import {
  runStoreNodes,
  sendMessages,
  TestDecoder,
  TestShardInfo,
  totalMsgs
} from "./utils.js";

describe("Waku Store, message hash query", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestShardInfo);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, [waku]);
  });

  it("can query messages normally", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic,
      true
    );

    const messages: IDecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder])) {
      for await (const msg of page) {
        messages.push(msg as IDecodedMessage);
      }
    }

    expect(messages.length).to.equal(totalMsgs);
  });

  it("can query messages by message hash", async function () {
    const sentMessages = await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic,
      true
    );
    const messageHashes = sentMessages.map((msg) =>
      messageHash(TestDecoder.pubsubTopic, {
        pubsubTopic: TestDecoder.pubsubTopic,
        payload: Buffer.from(msg.payload, "base64"),
        contentTopic: msg.contentTopic || TestDecoder.contentTopic,
        timestamp: msg.timestamp
          ? new Date(Number(msg.timestamp / 1000000n))
          : undefined,
        meta: undefined,
        rateLimitProof: undefined,
        ephemeral: undefined
      })
    );

    const messages: IDecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder], {
      messageHashes,
      pubsubTopic: TestDecoder.pubsubTopic
    })) {
      for await (const msg of page) {
        messages.push(msg as IDecodedMessage);
      }
    }
    expect(messages.length).to.equal(messageHashes.length);
    for (const msg of messages) {
      expect(msg.contentTopic).to.equal(TestDecoder.contentTopic);
    }
  });
});
