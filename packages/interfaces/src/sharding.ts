export type ShardInfo = {
  clusterId: number;
  shards: number[];
};

export type ContentTopicInfo = {
  clusterId?: number; // TODO: This should be mandatory on a network config
  contentTopics: string[];
};

export type StaticSharding = ShardInfo;
export type AutoSharding = ContentTopicInfo;
export type ClusterId = number;
