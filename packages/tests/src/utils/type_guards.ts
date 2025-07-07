import type {
  ContentTopicInfo,
  CreateNodeOptions,
  StaticSharding
} from "@waku/interfaces";

export function isStaticSharding(
  config: NonNullable<CreateNodeOptions["networkConfig"]>
): config is StaticSharding {
  return (
    "clusterId" in config && "shards" in config && !("contentTopics" in config)
  );
}

export function isAutoSharding(
  config: NonNullable<CreateNodeOptions["networkConfig"]>
): config is ContentTopicInfo {
  return "contentTopics" in config;
}
