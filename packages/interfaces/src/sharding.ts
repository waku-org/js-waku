export type ShardInfo = {
  clusterId: number;
  shards: number[];
};

export type ContentTopicInfo = {
  clusterId: number;
  contentTopics: string[];
};

export type StaticSharding = ShardInfo;
export type AutoSharding = ContentTopicInfo;
