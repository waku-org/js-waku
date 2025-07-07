export type SubscribedShardsInfo = {
  clusterId: number;
  shards: number[];
};

export type ContentTopicInfo = {
  clusterId?: number;
  contentTopics: string[];
  numShardsInNetwork?: number;
};

export type StaticSharding = {
  clusterId: number;
};

export type AutoSharding = StaticSharding & {
  numShardsInNetwork?: number;
};

// export type StaticSharding = ShardInfo;
// export type AutoSharding = ContentTopicInfo;
