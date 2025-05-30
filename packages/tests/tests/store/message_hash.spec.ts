import { DecodedMessage } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { messageHash } from "@waku/message-hash";
import { assert } from "chai";

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

    const messages: DecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder])) {
      for await (const msg of page) {
        messages.push(msg as DecodedMessage);
      }
    }

    assert.equal(messages.length, totalMsgs);
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

    console.log("Sent messages:", sentMessages.length);
    console.log("First message:", sentMessages[0]);
    console.log("Message hashes:", messageHashes.length);
    console.log("First hash:", messageHashes[0]);

    const messages: DecodedMessage[] = [];
    let pageCount = 0;
    try {
      for await (const page of waku.store.queryGenerator([TestDecoder], {
        messageHashes,
        pubsubTopic: TestDecoder.pubsubTopic
      })) {
        pageCount++;
        console.log(`Page ${pageCount} received`);
        for await (const msg of page) {
          messages.push(msg as DecodedMessage);
        }
      }
    } catch (error) {
      console.error("Error during query:", error);
      throw error;
    }
    console.log("Total pages:", pageCount);
    console.log("Total messages received:", messages.length);
    assert.equal(messages.length, messageHashes.length);
    for (const msg of messages) {
      assert.equal(msg.contentTopic, TestDecoder.contentTopic);
    }
  });
});
