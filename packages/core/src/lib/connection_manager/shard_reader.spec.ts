import { PeerId } from "@libp2p/interface";
import {
  AutoSharding,
  DEFAULT_NUM_SHARDS,
  NetworkConfig,
  PubsubTopic,
  ShardInfo
} from "@waku/interfaces";
import { contentTopicToShardIndex, encodeRelayShard } from "@waku/utils";
import { expect } from "chai";
import { Libp2p } from "libp2p";
import sinon from "sinon";

import { ShardReader } from "./shard_reader.js";

const createMockPeerId = (): PeerId => {
  const mockPeerId = {
    toString: () => "12D3KooWTest123",
    equals: (other: PeerId) => other.toString() === "12D3KooWTest123"
  };
  return mockPeerId as unknown as PeerId;
};

describe("ShardReader", function () {
  let mockLibp2p: sinon.SinonStubbedInstance<Libp2p>;
  let mockPeerStore: any;
  let shardReader: ShardReader;
  let testPeerId: PeerId;

  const testContentTopic = "/test/1/waku-light-push/utf8";
  const testClusterId = 3;
  const testShardIndex = contentTopicToShardIndex(
    testContentTopic,
    DEFAULT_NUM_SHARDS
  );

  const testNetworkConfig: AutoSharding = {
    clusterId: testClusterId,
    numShardsInCluster: DEFAULT_NUM_SHARDS
  };

  const testShardInfo: ShardInfo = {
    clusterId: testClusterId,
    shards: [testShardIndex]
  };

  beforeEach(async function () {
    testPeerId = createMockPeerId();

    mockPeerStore = {
      get: sinon.stub(),
      save: sinon.stub(),
      merge: sinon.stub()
    };

    mockLibp2p = {
      peerStore: mockPeerStore
    } as any;

    shardReader = new ShardReader({
      libp2p: mockLibp2p as any,
      networkConfig: testNetworkConfig
    });
  });

  afterEach(function () {
    sinon.restore();
  });

  describe("constructor", function () {
    it("should create ShardReader with auto sharding network config", function () {
      const config: AutoSharding = {
        clusterId: 3,
        numShardsInCluster: 10
      };

      const reader = new ShardReader({
        libp2p: mockLibp2p as any,
        networkConfig: config
      });

      expect(reader).to.be.instanceOf(ShardReader);
    });

    it("should create ShardReader with static shards network config", function () {
      const config: NetworkConfig = {
        clusterId: 3
      };

      const reader = new ShardReader({
        libp2p: mockLibp2p as any,
        networkConfig: config
      });

      expect(reader).to.be.instanceOf(ShardReader);
    });
  });

  describe("isPeerOnNetwork", function () {
    it("should return true when peer is on the same cluster", async function () {
      const shardInfoBytes = encodeRelayShard(testShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const result = await shardReader.isPeerOnCluster(testPeerId);

      expect(result).to.be.true;
      sinon.assert.calledWith(mockPeerStore.get, testPeerId);
    });

    it("should return false when peer is on different cluster", async function () {
      const differentClusterShardInfo: ShardInfo = {
        clusterId: 5,
        shards: [1, 2]
      };
      const shardInfoBytes = encodeRelayShard(differentClusterShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const result = await shardReader.isPeerOnCluster(testPeerId);

      expect(result).to.be.false;
    });

    it("should return true even if peer has no overlapping shards", async function () {
      const noOverlapShardInfo: ShardInfo = {
        clusterId: testClusterId,
        shards: [testShardIndex + 100, testShardIndex + 200] // Use different shards
      };
      const shardInfoBytes = encodeRelayShard(noOverlapShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const result = await shardReader.isPeerOnCluster(testPeerId);

      expect(result).to.be.true;
    });

    it("should return false when peer has no shard info", async function () {
      const mockPeer = {
        metadata: new Map()
      };

      mockPeerStore.get.resolves(mockPeer);

      const result = await shardReader.isPeerOnCluster(testPeerId);

      expect(result).to.be.false;
    });

    it("should return false when peer is not found", async function () {
      mockPeerStore.get.rejects(new Error("Peer not found"));

      const result = await shardReader.isPeerOnCluster(testPeerId);

      expect(result).to.be.false;
    });
  });

  describe("isPeerOnShard", function () {
    it("should return true when peer is on the specified shard", async function () {
      const shardInfoBytes = encodeRelayShard(testShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const result = await shardReader.isPeerOnShard(
        testPeerId,
        testShardIndex
      );

      expect(result).to.be.true;
    });

    it("should return false when peer is on different cluster", async function () {
      const shardInfoBytes = encodeRelayShard(testShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const shardReaderCluster5 = new ShardReader({
        libp2p: mockLibp2p as any,
        networkConfig: { clusterId: 5 }
      });

      const result = await shardReaderCluster5.isPeerOnShard(
        testPeerId,
        testShardIndex
      );

      expect(result).to.be.false;
    });

    it("should return false when peer is not on the specified shard", async function () {
      const shardInfoBytes = encodeRelayShard(testShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const result = await shardReader.isPeerOnShard(
        testPeerId,
        testShardIndex + 100
      );

      expect(result).to.be.false;
    });

    it("should return false when peer shard info is not found", async function () {
      mockPeerStore.get.rejects(new Error("Peer not found"));

      const result = await shardReader.isPeerOnShard(
        testPeerId,
        testShardIndex
      );

      expect(result).to.be.false;
    });
  });

  describe("isPeerOnTopic", function () {
    it("should return true when peer is on the pubsub topic shard", async function () {
      const shardInfoBytes = encodeRelayShard(testShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const pubsubTopic: PubsubTopic = `/waku/2/rs/${testClusterId}/${testShardIndex}`;

      const result = await shardReader.isPeerOnTopic(testPeerId, pubsubTopic);

      expect(result).to.be.true;
    });

    it("should return false when peer is not on the pubsub topic shard", async function () {
      const shardInfoBytes = encodeRelayShard(testShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const pubsubTopic: PubsubTopic = `/waku/2/rs/${testClusterId}/${testShardIndex + 100}`;

      const result = await shardReader.isPeerOnTopic(testPeerId, pubsubTopic);

      expect(result).to.be.false;
    });

    it("should return false when pubsub topic parsing fails", async function () {
      const shardInfoBytes = encodeRelayShard(testShardInfo);
      const mockPeer = {
        metadata: new Map([["shardInfo", shardInfoBytes]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const invalidPubsubTopic: PubsubTopic = "/invalid/topic";

      const result = await shardReader.isPeerOnTopic(
        testPeerId,
        invalidPubsubTopic
      );

      expect(result).to.be.false;
    });

    it("should return false when peer is not found", async function () {
      mockPeerStore.get.rejects(new Error("Peer not found"));

      const pubsubTopic: PubsubTopic = `/waku/2/rs/${testClusterId}/${testShardIndex}`;

      const result = await shardReader.isPeerOnTopic(testPeerId, pubsubTopic);

      expect(result).to.be.false;
    });
  });

  describe("error handling", function () {
    it("should handle errors gracefully when getting peer info", async function () {
      mockPeerStore.get.rejects(new Error("Network error"));

      const result = await shardReader.isPeerOnCluster(testPeerId);

      expect(result).to.be.false;
    });

    it("should handle corrupted shard info gracefully", async function () {
      const mockPeer = {
        metadata: new Map([["shardInfo", new Uint8Array([1, 2, 3])]])
      };

      mockPeerStore.get.resolves(mockPeer);

      const result = await shardReader.isPeerOnCluster(testPeerId);

      expect(result).to.be.false;
    });
  });
});
