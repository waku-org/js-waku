import { expect } from "chai";

import {
  contentTopicsByPubsubTopic,
  contentTopicToPubsubTopic,
  contentTopicToShardIndex,
  ensureValidContentTopic
} from "./sharding";

const testInvalidCases = (
  contentTopics: string[],
  expectedError: string
): void => {
  for (const invalidTopic of contentTopics) {
    expect(() => ensureValidContentTopic(invalidTopic)).to.throw(expectedError);
  }
};

describe("ensureValidContentTopic", () => {
  it("does not throw on valid cases", () => {
    const validTopics = [
      "/0/myapp/1/mytopic/cbor",
      "/myapp/1/mytopic/cbor",
      "/myapp/v1.1/mytopic/cbor"
    ];
    for (const validTopic of validTopics) {
      expect(() => ensureValidContentTopic(validTopic)).to.not.throw;
    }
  });
  it("throws on empty content topic", () => {
    testInvalidCases(["", " ", "   "], "Content topic format is invalid");
  });

  it("throws on content topic with too few or too many fields", () => {
    testInvalidCases(
      [
        "myContentTopic",
        "myapp1mytopiccbor/",
        " /myapp/1/mytopic",
        "/myapp/1/mytopic",
        "/0/myapp/1/mytopic/cbor/extra"
      ],
      "Content topic format is invalid"
    );
  });

  it("throws on content topic with non-number generation field", () => {
    testInvalidCases(
      [
        "/a/myapp/1/mytopic/cbor",
        "/ /myapp/1/mytopic/cbor",
        "/_/myapp/1/mytopic/cbor",
        "/$/myapp/1/mytopic/cbor"
      ],
      "Invalid generation field in content topic"
    );
  });

  // Note that this test case should be removed once Waku supports other generations
  it("throws on content topic with generation field greater than 0", () => {
    testInvalidCases(
      [
        "/1/myapp/1/mytopic/cbor",
        "/2/myapp/1/mytopic/cbor",
        "/3/myapp/1/mytopic/cbor",
        "/1000/myapp/1/mytopic/cbor",
        "/1/toychat/2/huilong/proto",
        "/1/statusim/1/community/cbor"
      ],
      "Generation greater than 0 is not supported"
    );
  });

  it("throws on content topic with empty application field", () => {
    testInvalidCases(
      ["/0//1/mytopic/cbor"],
      "Application field cannot be empty"
    );
  });

  it("throws on content topic with empty version field", () => {
    testInvalidCases(
      ["/0/myapp//mytopic/cbor"],
      "Version field cannot be empty"
    );
  });

  it("throws on content topic with empty topic name field", () => {
    testInvalidCases(["/0/myapp/1//cbor"], "Topic name field cannot be empty");
  });

  it("throws on content topic with empty encoding field", () => {
    testInvalidCases(["/0/myapp/1/mytopic/"], "Encoding field cannot be empty");
  });
});

describe("contentTopicToShardIndex", () => {
  it("converts content topics to expected shard index", () => {
    const contentTopics: [string, number][] = [
      ["/toychat/2/huilong/proto", 3],
      ["/myapp/1/latest/proto", 0],
      ["/waku/2/content/test.js", 1],
      ["/toychat/2/huilong/proto", 3],
      ["/0/toychat/2/huilong/proto", 3],
      ["/statusim/1/community/cbor", 4],
      ["/0/statusim/1/community/cbor", 4]
    ];
    for (const [topic, shard] of contentTopics) {
      expect(contentTopicToShardIndex(topic)).to.eq(shard);
    }
  });

  it("topics with same application and version share the same shard", () => {
    const contentTopics: [string, string][] = [
      ["/toychat/2/huilong/proto", "/toychat/2/othertopic/otherencoding"],
      ["/myapp/1/latest/proto", "/myapp/1/new/proto"],
      ["/waku/2/content/test.js", "/waku/2/users/proto"]
    ];
    for (const [topic1, topic2] of contentTopics) {
      expect(contentTopicToShardIndex(topic1)).to.eq(
        contentTopicToShardIndex(topic2)
      );
    }
  });
});

describe("contentTopicsByPubsubTopic", () => {
  it("groups content topics by expected pubsub topic", () => {
    const contentTopics = ["/toychat/2/huilong/proto", "/myapp/1/latest/proto"];
    const grouped = contentTopicsByPubsubTopic(contentTopics);
    for (const contentTopic of contentTopics) {
      const pubsubTopic = contentTopicToPubsubTopic(contentTopic);
      expect(grouped.get(pubsubTopic)?.includes(contentTopic)).to.be.true;
    }
  });
});

describe("contentTopicsByPubsubTopic", () => {
  it("groups content topics by expected pubsub topic", () => {
    const contentTopics = ["/toychat/2/huilong/proto", "/myapp/1/latest/proto"];
    const grouped = contentTopicsByPubsubTopic(contentTopics);
    for (const contentTopic of contentTopics) {
      const pubsubTopic = contentTopicToPubsubTopic(contentTopic);
      expect(grouped.get(pubsubTopic)?.includes(contentTopic)).to.be.true;
    }
  });
});
