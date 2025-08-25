import { DEFAULT_CLUSTER_ID } from "@waku/interfaces";
import { expect } from "chai";

import {
  contentTopicsByPubsubTopic,
  contentTopicToPubsubTopic,
  contentTopicToShardIndex,
  ensureValidContentTopic,
  pubsubTopicToSingleShardInfo
} from "./topics.js";

const ClusterId = 0;
const NumShardsInCluster = 8;

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
  const contentTopicsWithExpectedShards: [string, number][] = [
    ["/toychat/2/huilong/proto", 3],
    ["/myapp/1/latest/proto", 0],
    ["/waku/2/content/test.js", 1],
    ["/toychat/2/huilong/proto", 3],
    ["/0/toychat/2/huilong/proto", 3],
    ["/statusim/1/community/cbor", 4],
    ["/0/statusim/1/community/cbor", 4],
    ["/app/22/sometopic/someencoding", 2],
    ["/app/27/sometopic/someencoding", 5],
    ["/app/20/sometopic/someencoding", 7],
    ["/app/29/sometopic/someencoding", 6]
  ];
  contentTopicsWithExpectedShards.forEach(([topic, expectedShard]) => {
    it(`should correctly map ${topic} to shard index ${expectedShard}`, () => {
      expect(contentTopicToShardIndex(topic, NumShardsInCluster)).to.eq(
        expectedShard
      );
    });
  });

  const testCases: [number, string, number][] = [
    [16, "/app/20/sometopic/someencoding", 15],
    [2, "/app/20/sometopic/someencoding", 1],
    [1, "/app/20/sometopic/someencoding", 0]
  ];

  testCases.forEach(([networkShards, topic, expectedShard]) => {
    it(`should correctly map ${topic} to shard index ${expectedShard} with networkShards ${networkShards}`, () => {
      expect(contentTopicToShardIndex(topic, networkShards)).to.eq(
        expectedShard
      );
    });
  });

  it("topics with same application and version share the same shard", () => {
    const contentTopics: [string, string][] = [
      ["/toychat/2/huilong/proto", "/toychat/2/othertopic/otherencoding"],
      ["/myapp/1/latest/proto", "/myapp/1/new/proto"],
      ["/waku/2/content/test.js", "/waku/2/users/proto"]
    ];
    for (const [topic1, topic2] of contentTopics) {
      expect(contentTopicToShardIndex(topic1, NumShardsInCluster)).to.eq(
        contentTopicToShardIndex(topic2, NumShardsInCluster)
      );
    }
  });
});

describe("contentTopicsByPubsubTopic", () => {
  it("groups content topics by expected pubsub topic", () => {
    const contentTopics = ["/toychat/2/huilong/proto", "/myapp/1/latest/proto"];
    const grouped = contentTopicsByPubsubTopic(
      contentTopics,
      ClusterId,
      NumShardsInCluster
    );

    for (const contentTopic of contentTopics) {
      const pubsubTopic = contentTopicToPubsubTopic(contentTopic, 0, 8);

      expect(grouped.get(pubsubTopic)?.includes(contentTopic)).to.be.true;
    }
  });

  it("groups multiple content topics into the same pubsub topic when they share the same shard index", () => {
    const contentTopics = [
      "/app/22/sometopic/someencoding",
      "/app/22/anothertopic/otherencoding"
    ];
    const grouped = contentTopicsByPubsubTopic(
      contentTopics,
      ClusterId,
      NumShardsInCluster
    );
    expect(grouped.size).to.eq(1); // Only one pubsub topic expected
    const pubsubTopic = contentTopicToPubsubTopic(contentTopics[0], 0, 8);
    expect(grouped.get(pubsubTopic)?.length).to.eq(2); // Both topics should be grouped under the same pubsub topic
  });

  it("handles different clusterIds correctly", () => {
    const contentTopics = ["/app/22/sometopic/someencoding"];
    const clusterId1 = 3;
    const clusterId2 = 2;
    const grouped1 = contentTopicsByPubsubTopic(
      contentTopics,
      clusterId1,
      NumShardsInCluster
    );
    const grouped2 = contentTopicsByPubsubTopic(
      contentTopics,
      clusterId2,
      NumShardsInCluster
    );
    const pubsubTopic1 = contentTopicToPubsubTopic(
      contentTopics[0],
      clusterId1,
      8
    );
    const pubsubTopic2 = contentTopicToPubsubTopic(
      contentTopics[0],
      clusterId2,
      8
    );
    expect(pubsubTopic1).not.to.equal(pubsubTopic2);
    expect(grouped1.has(pubsubTopic1)).to.be.true;
    expect(grouped1.has(pubsubTopic2)).to.be.false;
    expect(grouped2.has(pubsubTopic1)).to.be.false;
    expect(grouped2.has(pubsubTopic2)).to.be.true;
  });

  it("handles different networkShards values correctly", () => {
    const contentTopics = ["/app/20/sometopic/someencoding"];
    const networkShards1 = 8;
    const networkShards2 = 16;
    const grouped1 = contentTopicsByPubsubTopic(
      contentTopics,
      DEFAULT_CLUSTER_ID,
      networkShards1
    );
    const grouped2 = contentTopicsByPubsubTopic(
      contentTopics,
      DEFAULT_CLUSTER_ID,
      networkShards2
    );
    const pubsubTopic1 = contentTopicToPubsubTopic(
      contentTopics[0],
      DEFAULT_CLUSTER_ID,
      networkShards1
    );
    const pubsubTopic2 = contentTopicToPubsubTopic(
      contentTopics[0],
      DEFAULT_CLUSTER_ID,
      networkShards2
    );
    expect(pubsubTopic1).not.to.equal(pubsubTopic2);
    expect(grouped1.has(pubsubTopic1)).to.be.true;
    expect(grouped1.has(pubsubTopic2)).to.be.false;
    expect(grouped2.has(pubsubTopic1)).to.be.false;
    expect(grouped2.has(pubsubTopic2)).to.be.true;
  });

  it("throws an error for improperly formatted content topics", () => {
    const invalidContentTopics = ["/invalid/format"];
    expect(() =>
      contentTopicsByPubsubTopic(
        invalidContentTopics,
        ClusterId,
        NumShardsInCluster
      )
    ).to.throw();
  });
});

describe("pubsubTopicToSingleShardInfo with various invalid formats", () => {
  const invalidTopics = [
    "/waku/1/rs/1/2", // Invalid Waku version
    "/waku/2/r/1/2", // Invalid path segment
    "/incorrect/format", // Completely incorrect format
    "/waku/2/rs", // Missing both clusterId and shard
    "/waku/2/rs/1/2/extra" // Extra trailing data
  ];

  it("should extract SingleShardInfo from a valid PubsubTopic", () => {
    const topic = "/waku/2/rs/2/2";
    const expectedInfo = { clusterId: 2, shard: 2 };
    expect(pubsubTopicToSingleShardInfo(topic)).to.deep.equal(expectedInfo);
  });

  invalidTopics.forEach((topic) => {
    it(`should throw an error for invalid PubsubTopic format: ${topic}`, () => {
      expect(() => pubsubTopicToSingleShardInfo(topic)).to.throw(
        "Invalid pubsub topic"
      );
    });
  });

  const nonNumericValues = ["x", "y", "$", "!", "\\", "-", "", " "];
  nonNumericValues.forEach((value) => {
    it(`should throw an error for non-numeric clusterId: /waku/2/rs/${value}/1`, () => {
      expect(() =>
        pubsubTopicToSingleShardInfo(`/waku/2/rs/${value}/1`)
      ).to.throw("Invalid clusterId or shard");
    });

    it(`should throw an error for non-numeric shard: /waku/2/rs/1/${value}`, () => {
      expect(() =>
        pubsubTopicToSingleShardInfo(`/waku/2/rs/1/${value}`)
      ).to.throw("Invalid clusterId or shard");
    });
  });
});
