import { expect } from "chai";

import { DefaultBloomFilter } from "../bloom_filter/bloom.js";

import { decodeMessage, encodeMessage, Message } from "./events.js";
import { DEFAULT_BLOOM_FILTER_OPTIONS } from "./message_channel.js";

describe("Message serialization", () => {
  it("Bloom filter", () => {
    const messageIds = ["first", "second", "third"];

    const bloomFilter = new DefaultBloomFilter(DEFAULT_BLOOM_FILTER_OPTIONS);
    for (const id of messageIds) {
      bloomFilter.insert(id);
    }

    const message: Message = {
      messageId: "123",
      channelId: "my-channel",
      causalHistory: [],
      lamportTimestamp: 0,
      bloomFilter: bloomFilter.toBytes()
    };
    const bytes = encodeMessage(message);
    const decMessage = decodeMessage(bytes);
    const decBloomFilter = DefaultBloomFilter.fromBytes(
      decMessage!.bloomFilter!,
      DEFAULT_BLOOM_FILTER_OPTIONS
    );
    for (const id of messageIds) {
      expect(decBloomFilter.lookup(id)).to.be.true;
    }
  });
});
