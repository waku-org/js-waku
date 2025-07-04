import type {
  CreateDecoderParams,
  NetworkConfig,
  SingleShardInfo
} from "@waku/interfaces";
import { DEFAULT_NUM_SHARDS } from "@waku/interfaces";
import { contentTopicToShardIndex } from "@waku/utils";

export const decoderParamsToShardInfo = (
  params: CreateDecoderParams,
  networkConfig: NetworkConfig
): SingleShardInfo => {
  const clusterId = (params.shardInfo?.clusterId ||
    networkConfig.clusterId) as number;
  const shardsUnderCluster =
    params.shardInfo && "shardsUnderCluster" in params.shardInfo
      ? params.shardInfo.shardsUnderCluster
      : DEFAULT_NUM_SHARDS;

  const shardIndex =
    params.shardInfo && "shard" in params.shardInfo
      ? params.shardInfo.shard
      : contentTopicToShardIndex(params.contentTopic, shardsUnderCluster);

  return {
    clusterId,
    shard: shardIndex
  };
};

export const isShardCompatible = (
  shardInfo: SingleShardInfo,
  networkConfig: NetworkConfig
): boolean => {
  if (networkConfig.clusterId !== shardInfo.clusterId) {
    return false;
  }

  if (
    "shards" in networkConfig &&
    !networkConfig.shards.includes(shardInfo.shard!)
  ) {
    return false;
  }

  return true;
};
