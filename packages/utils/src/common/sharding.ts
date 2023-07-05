import { PubSubTopic, ShardInfo } from "@waku/interfaces";

export const getPubsubTopicsFromShardInfo = (
  shardInfo: ShardInfo
): PubSubTopic[] => {
  return shardInfo.indices.map(
    (index) => `/waku/2/${shardInfo.cluster}/${index}`
  );
};
