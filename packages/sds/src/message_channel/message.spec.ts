import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { DefaultBloomFilter } from "../bloom_filter/bloom.js";

import { ContentMessage, Message } from "./message.js";
import { DEFAULT_BLOOM_FILTER_OPTIONS } from "./message_channel.js";

describe("Message serialization", () => {
  it("Bloom filter", () => {
    const messageId = "first";

    const bloomFilter = new DefaultBloomFilter(DEFAULT_BLOOM_FILTER_OPTIONS);
    bloomFilter.insert(messageId);

    const message = new Message(
      "123",
      "my-channel",
      "me",
      [],
      0,
      bloomFilter.toBytes(),
      undefined
    );

    const bytes = message.encode();
    const decMessage = Message.decode(bytes);

    const decBloomFilter = DefaultBloomFilter.fromBytes(
      decMessage!.bloomFilter!,
      DEFAULT_BLOOM_FILTER_OPTIONS
    );

    expect(decBloomFilter.lookup(messageId)).to.be.true;
  });

  it("Retrieval Hint", () => {
    const depMessageId = "dependency";
    const depRetrievalHint = utf8ToBytes("dependency");
    const message = new Message(
      "123",
      "my-channel",
      "me",
      [{ messageId: depMessageId, retrievalHint: depRetrievalHint }],
      0,
      undefined,
      undefined
    );

    const bytes = message.encode();
    const decMessage = Message.decode(bytes);

    expect(decMessage!.causalHistory).to.deep.equal([
      { messageId: depMessageId, retrievalHint: depRetrievalHint }
    ]);
  });
});

describe("ContentMessage comparison with < operator", () => {
  it("should sort by lamportTimestamp when timestamps differ", () => {
    const msgA = new ContentMessage(
      "zzz", // Higher messageId
      "channel",
      "sender",
      [],
      100, // Lower timestamp
      undefined,
      new Uint8Array([1])
    );

    const msgB = new ContentMessage(
      "aaa", // Lower messageId
      "channel",
      "sender",
      [],
      200, // Higher timestamp
      undefined,
      new Uint8Array([2])
    );

    // Despite msgA having higher messageId, it should be < msgB due to lower timestamp
    expect(msgA < msgB).to.be.true;
    expect(msgB < msgA).to.be.false;
  });

  it("should sort by messageId when timestamps are equal", () => {
    const msgA = new ContentMessage(
      "aaa", // Lower messageId
      "channel",
      "sender",
      [],
      100, // Same timestamp
      undefined,
      new Uint8Array([1])
    );

    const msgB = new ContentMessage(
      "zzz", // Higher messageId
      "channel",
      "sender",
      [],
      100, // Same timestamp
      undefined,
      new Uint8Array([2])
    );

    expect(msgA < msgB).to.be.true;
    expect(msgB < msgA).to.be.false;
  });
});
