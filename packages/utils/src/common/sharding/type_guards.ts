import type {
  AutoSharding,
  CreateNodeOptions,
  StaticSharding
} from "@waku/interfaces";

export function isStaticSharding(
  config: NonNullable<CreateNodeOptions["networkConfig"]>
): config is StaticSharding {
  return "clusterId" in config && !("numShardsInCluster" in config);
}

export function isAutoSharding(
  config: NonNullable<CreateNodeOptions["networkConfig"]>
): config is AutoSharding {
  return "clusterId" in config && "numShardsInCluster" in config;
}
