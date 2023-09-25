import type { PubSubTopic, ShardInfo } from "@waku/interfaces";

export const getPubsubTopicsFromShardInfo = (
  shardInfo: ShardInfo
): PubSubTopic[] => {
  return shardInfo.indices.map(
    (index) => `/waku/2/rs/${shardInfo.cluster}/${index}`
  );
};
