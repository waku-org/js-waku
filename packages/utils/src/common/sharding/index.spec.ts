import { DEFAULT_CLUSTER_ID, NetworkConfig } from "@waku/interfaces";
import { expect } from "chai";

import {
  contentTopicsByPubsubTopic,
  contentTopicToPubsubTopic,
  contentTopicToShardIndex,
  determinePubsubTopic,
  ensureShardingConfigured,
  ensureValidContentTopic,
  pubsubTopicToSingleShardInfo,
  shardInfoToPubsubTopics,
  singleShardInfosToShardInfo,
  singleShardInfoToPubsubTopic
} from "./index.js";

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
      expect(contentTopicToShardIndex(topic)).to.eq(expectedShard);
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

  it("groups multiple content topics into the same pubsub topic when they share the same shard index", () => {
    const contentTopics = [
      "/app/22/sometopic/someencoding",
      "/app/22/anothertopic/otherencoding"
    ];
    const grouped = contentTopicsByPubsubTopic(contentTopics);
    expect(grouped.size).to.eq(1); // Only one pubsub topic expected
    const pubsubTopic = contentTopicToPubsubTopic(contentTopics[0]);
    expect(grouped.get(pubsubTopic)?.length).to.eq(2); // Both topics should be grouped under the same pubsub topic
  });

  it("handles different clusterIds correctly", () => {
    const contentTopics = ["/app/22/sometopic/someencoding"];
    const clusterId1 = 1;
    const clusterId2 = 2;
    const grouped1 = contentTopicsByPubsubTopic(contentTopics, clusterId1);
    const grouped2 = contentTopicsByPubsubTopic(contentTopics, clusterId2);
    const pubsubTopic1 = contentTopicToPubsubTopic(
      contentTopics[0],
      clusterId1
    );
    const pubsubTopic2 = contentTopicToPubsubTopic(
      contentTopics[0],
      clusterId2
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
    expect(() => contentTopicsByPubsubTopic(invalidContentTopics)).to.throw();
  });
});

describe("singleShardInfoToPubsubTopic", () => {
  it("should convert a SingleShardInfo object to the correct PubsubTopic", () => {
    const singleShardInfo = { clusterId: 2, shard: 2 };
    const expectedTopic = "/waku/2/rs/2/2";
    expect(singleShardInfoToPubsubTopic(singleShardInfo)).to.equal(
      expectedTopic
    );
  });
});

describe("singleShardInfosToShardInfo", () => {
  it("should aggregate SingleShardInfos into a ShardInfo", () => {
    const singleShardInfos = [
      { clusterId: 1, shard: 2 },
      { clusterId: 1, shard: 3 },
      { clusterId: 1, shard: 5 }
    ];
    const expectedShardInfo = { clusterId: 1, shards: [2, 3, 5] };
    expect(singleShardInfosToShardInfo(singleShardInfos)).to.deep.equal(
      expectedShardInfo
    );
  });

  it("should throw an error for empty SingleShardInfos array", () => {
    expect(() => singleShardInfosToShardInfo([])).to.throw("Invalid shard");
  });

  it("should throw an error for SingleShardInfos with different clusterIds", () => {
    const invalidShardInfos = [
      { clusterId: 1, shard: 2 },
      { clusterId: 2, shard: 3 }
    ];
    expect(() => singleShardInfosToShardInfo(invalidShardInfos)).to.throw(
      "Passed shard infos have different clusterIds"
    );
  });
});

describe("shardInfoToPubsubTopics", () => {
  it("should convert content topics to PubsubTopics for autosharding", () => {
    const shardInfo = {
      contentTopics: ["/app/v1/topic1/proto", "/app/v1/topic2/proto"]
    };
    const topics = shardInfoToPubsubTopics(shardInfo);
    expect(topics).to.be.an("array").that.includes("/waku/2/rs/1/4");
    expect(topics.length).to.equal(1);
  });

  it("should return unique PubsubTopics for static sharding", () => {
    const shardInfo = { clusterId: 1, shards: [0, 1, 0] }; // Duplicate shard to test uniqueness
    const topics = shardInfoToPubsubTopics(shardInfo);
    expect(topics).to.have.members(["/waku/2/rs/1/0", "/waku/2/rs/1/1"]);
    expect(topics.length).to.equal(2);
  });

  [0, 1, 6].forEach((clusterId) => {
    it(`should handle clusterId, application and version for autosharding with cluster iD ${clusterId}`, () => {
      const shardInfo = {
        clusterId: clusterId,
        application: "app",
        version: "v1"
      };
      const topics = shardInfoToPubsubTopics(shardInfo);
      expect(topics)
        .to.be.an("array")
        .that.includes(`/waku/2/rs/${clusterId}/4`);
      expect(topics.length).to.equal(1);
    });
  });

  it("should return empty list for no shard", () => {
    const shardInfo = { clusterId: 1, shards: [] };
    const topics = shardInfoToPubsubTopics(shardInfo);
    expect(topics.length).to.equal(0);
  });

  it("should throw an error if shards are undefined for static sharding", () => {
    const shardInfo = { clusterId: 1, shards: undefined };
    expect(() => shardInfoToPubsubTopics(shardInfo)).to.throw("Invalid shard");
  });

  it("should throw an error for missing required configuration", () => {
    const shardInfo = {};
    expect(() => shardInfoToPubsubTopics(shardInfo)).to.throw(
      "Missing required configuration in shard parameters"
    );
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
    const topic = "/waku/2/rs/1/2";
    const expectedInfo = { clusterId: 1, shard: 2 };
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

describe("determinePubsubTopic", () => {
  const contentTopic = "/app/46/sometopic/someencoding";
  it("should return the pubsub topic directly if a string is provided", () => {
    const topic = "/waku/2/rs/1/3";
    expect(determinePubsubTopic(contentTopic, topic)).to.equal(topic);
  });

  it("should return a calculated topic if SingleShardInfo is provided", () => {
    const info = { clusterId: 1, shard: 2 };
    const expectedTopic = "/waku/2/rs/1/2";
    expect(determinePubsubTopic(contentTopic, info)).to.equal(expectedTopic);
  });

  it("should fall back to default pubsub topic when pubsubTopicShardInfo is not provided", () => {
    expect(determinePubsubTopic(contentTopic)).to.equal("/waku/2/rs/1/6");
  });

  it("should process correctly when SingleShardInfo has no clusterId but has a shard", () => {
    const info = { shard: 0 };
    const expectedTopic = `/waku/2/rs/${DEFAULT_CLUSTER_ID}/0`;
    expect(determinePubsubTopic(contentTopic, info as any)).to.equal(
      expectedTopic
    );
  });

  it("should derive a pubsub topic using contentTopic when SingleShardInfo only contains clusterId", () => {
    const info = { clusterId: 2 };
    const expectedTopic = contentTopicToPubsubTopic(
      contentTopic,
      info.clusterId
    );
    expect(determinePubsubTopic(contentTopic, info as any)).to.equal(
      expectedTopic
    );
  });
});

describe("ensureShardingConfigured", () => {
  it("should return valid sharding parameters for static sharding", () => {
    const shardInfo = { clusterId: 1, shards: [0, 1] };
    const result = ensureShardingConfigured(shardInfo);
    expect(result.shardInfo).to.deep.include({
      clusterId: 1,
      shards: [0, 1]
    });
    expect(result.shardInfo).to.deep.include({ clusterId: 1, shards: [0, 1] });
    expect(result.pubsubTopics).to.have.members([
      "/waku/2/rs/1/0",
      "/waku/2/rs/1/1"
    ]);
  });

  it("should return valid sharding parameters for content topics autosharding", () => {
    const contentTopicInfo = { contentTopics: ["/app/v1/topic1/proto"] };
    const result = ensureShardingConfigured(contentTopicInfo);
    const expectedPubsubTopic = contentTopicToPubsubTopic(
      "/app/v1/topic1/proto",
      DEFAULT_CLUSTER_ID
    );
    expect(result.shardInfo.shards).to.include(
      contentTopicToShardIndex("/app/v1/topic1/proto")
    );
    expect(result.pubsubTopics).to.include(expectedPubsubTopic);
  });

  it("should throw an error for missing sharding configuration", () => {
    const shardInfo = {} as any as NetworkConfig;
    expect(() => ensureShardingConfigured(shardInfo)).to.throw();
  });

  it("handles empty shards array correctly", () => {
    const shardInfo = { clusterId: 1, shards: [] };
    expect(() => ensureShardingConfigured(shardInfo)).to.throw();
  });

  it("handles empty contentTopics array correctly", () => {
    const shardInfo = { contentTopics: [] };
    expect(() => ensureShardingConfigured(shardInfo)).to.throw();
  });
});

describe("contentTopicToPubsubTopic", () => {
  it("should correctly map a content topic to a pubsub topic", () => {
    const contentTopic = "/app/v1/topic1/proto";
    expect(contentTopicToPubsubTopic(contentTopic)).to.equal("/waku/2/rs/1/4");
  });

  it("should map different content topics to different pubsub topics based on shard index", () => {
    const contentTopic1 = "/app/v1/topic1/proto";
    const contentTopic2 = "/app/v2/topic2/proto";
    const pubsubTopic1 = contentTopicToPubsubTopic(contentTopic1);
    const pubsubTopic2 = contentTopicToPubsubTopic(contentTopic2);
    expect(pubsubTopic1).not.to.equal(pubsubTopic2);
  });

  it("should use the provided clusterId for the pubsub topic", () => {
    const contentTopic = "/app/v1/topic1/proto";
    const clusterId = 2;
    expect(contentTopicToPubsubTopic(contentTopic, clusterId)).to.equal(
      "/waku/2/rs/2/4"
    );
  });

  it("should correctly map a content topic to a pubsub topic for different network shard sizes", () => {
    const contentTopic = "/app/v1/topic1/proto";
    const networkShards = 16;
    expect(contentTopicToPubsubTopic(contentTopic, 1, networkShards)).to.equal(
      "/waku/2/rs/1/4"
    );
  });
});
