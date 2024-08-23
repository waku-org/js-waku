import type {
  ContentTopicInfo,
  ProtocolCreateOptions,
  StaticSharding
} from "@waku/interfaces";

export function isStaticSharding(
  config: NonNullable<ProtocolCreateOptions["networkConfig"]>
): config is StaticSharding {
  return (
    "clusterId" in config && "shards" in config && !("contentTopics" in config)
  );
}

export function isAutoSharding(
  config: NonNullable<ProtocolCreateOptions["networkConfig"]>
): config is ContentTopicInfo {
  return "contentTopics" in config;
}
