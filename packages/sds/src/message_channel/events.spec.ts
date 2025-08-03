import { expect } from "chai";

import { DefaultBloomFilter } from "../bloom_filter/bloom.js";

import { Message } from "./events.js";
import { DEFAULT_BLOOM_FILTER_OPTIONS } from "./message_channel.js";

describe("Message serialization", () => {
  it("Bloom filter", () => {
    const messageId = "first";

    const bloomFilter = new DefaultBloomFilter(DEFAULT_BLOOM_FILTER_OPTIONS);
    bloomFilter.insert(messageId);

    const message = new Message(
      "123",
      "my-channel",
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
});
