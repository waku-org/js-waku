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
        contentTopic: TestDecoder.contentTopic,
        timestamp: msg.timestamp
          ? new Date(Number(msg.timestamp / 1000000n))
          : undefined,
        meta: undefined,
        rateLimitProof: undefined,
        ephemeral: undefined
      })
    );
    const messages: DecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([], {
      messageHashes
    })) {
      for await (const msg of page) {
        messages.push(msg as DecodedMessage);
      }
    }
    assert.equal(messages.length, messageHashes.length);
  });
});
