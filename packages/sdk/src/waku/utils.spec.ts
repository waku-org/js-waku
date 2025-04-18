import { peerIdFromString } from "@libp2p/peer-id";
import { DEFAULT_NUM_SHARDS, DefaultNetworkConfig } from "@waku/interfaces";
import { contentTopicToShardIndex } from "@waku/utils";
import { expect } from "chai";

import {
  decoderParamsToShardInfo,
  isShardCompatible,
  mapToPeerIdOrMultiaddr
} from "./utils.js";

const TestContentTopic = "/test/1/waku-sdk/utf8";

describe("IWaku utils", () => {
  describe("mapToPeerIdOrMultiaddr", () => {
    it("should return PeerId when PeerId is provided", async () => {
      const peerId = peerIdFromString(
        "12D3KooWHFJGwBXD7ukXqKaQZYmV1U3xxN1XCNrgriSEyvkxf6nE"
      );

      const result = mapToPeerIdOrMultiaddr(peerId);

      expect(result).to.equal(peerId);
    });

    it("should return Multiaddr when Multiaddr input is provided", () => {
      const multiAddr =
        "/ip4/127.0.0.1/tcp/8000/p2p/12D3KooWHFJGwBXD7ukXqKaQZYmV1U3xxN1XCNrgriSEyvkxf6nE";

      const result = mapToPeerIdOrMultiaddr(multiAddr);

      expect(result.toString()).to.equal(multiAddr);
    });
  });

  describe("decoderParamsToShardInfo", () => {
    it("should use provided shard info when available", () => {
      const params = {
        contentTopic: TestContentTopic,
        shardInfo: {
          clusterId: 10,
          shard: 5
        }
      };

      const result = decoderParamsToShardInfo(params, DefaultNetworkConfig);

      expect(result.clusterId).to.equal(10);
      expect(result.shard).to.equal(5);
    });

    it("should use network config clusterId when shard info clusterId is not provided", () => {
      const params = {
        contentTopic: TestContentTopic,
        shardInfo: {
          clusterId: 1,
          shard: 5
        }
      };

      const result = decoderParamsToShardInfo(params, DefaultNetworkConfig);

      expect(result.clusterId).to.equal(1);
      expect(result.shard).to.equal(5);
    });

    it("should use shardsUnderCluster when provided", () => {
      const contentTopic = TestContentTopic;
      const params = {
        contentTopic,
        shardInfo: {
          clusterId: 10,
          shardsUnderCluster: 64
        }
      };

      const result = decoderParamsToShardInfo(params, DefaultNetworkConfig);
      const expectedShardIndex = contentTopicToShardIndex(contentTopic, 64);

      expect(result.clusterId).to.equal(10);
      expect(result.shard).to.equal(expectedShardIndex);
    });

    it("should calculate shard index from content topic when shard is not provided", () => {
      const contentTopic = TestContentTopic;
      const params = {
        contentTopic
      };

      const result = decoderParamsToShardInfo(params, DefaultNetworkConfig);
      const expectedShardIndex = contentTopicToShardIndex(
        contentTopic,
        DEFAULT_NUM_SHARDS
      );

      expect(result.clusterId).to.equal(1);
      expect(result.shard).to.equal(expectedShardIndex);
    });
  });

  describe("isShardCompatible", () => {
    it("should return false when clusterId doesn't match", () => {
      const shardInfo = {
        clusterId: 10,
        shard: 5
      };

      const result = isShardCompatible(shardInfo, DefaultNetworkConfig);

      expect(result).to.be.false;
    });

    it("should return false when shard is not included in network shards", () => {
      const shardInfo = {
        clusterId: 1,
        shard: 5
      };

      const networkConfig = {
        clusterId: 1,
        shards: [1, 2, 3, 4]
      };

      const result = isShardCompatible(shardInfo, networkConfig);

      expect(result).to.be.false;
    });

    it("should return true when clusterId matches and shard is included in network shards", () => {
      const shardInfo = {
        clusterId: 1,
        shard: 3
      };

      const networkConfig = {
        clusterId: 1,
        shards: [1, 2, 3, 4]
      };

      const result = isShardCompatible(shardInfo, networkConfig);

      expect(result).to.be.true;
    });
  });
});
