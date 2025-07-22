import {
  ContentTopic,
  type CreateNodeOptions,
  type NetworkConfig,
  Protocols,
  type ShardId
} from "@waku/interfaces";
import { createRelayNode, RelayCreateOptions } from "@waku/relay";
import { createLightNode, WakuNode } from "@waku/sdk";
import {
  createRoutingInfo,
  isAutoSharding,
  isStaticSharding,
  Logger,
  RoutingInfo
} from "@waku/utils";
import { Context } from "mocha";

import { NOISE_KEY_1 } from "../constants.js";
import { Args } from "../types.js";
import { makeLogFileName } from "../utils/index.js";

import { ServiceNode } from "./service_node.js";

export const log = new Logger("test:runNodes");

export const DEFAULT_DISCOVERIES_ENABLED = {
  dns: false,
  peerExchange: true,
  localPeerCache: false
};

type RunNodesOptions = {
  context: Context;
  networkConfig: NetworkConfig;
  relayShards?: ShardId[]; // Only for static sharding
  contentTopics?: ContentTopic[]; // Only for auto sharding
  protocols: Protocols[];
  createNode: typeof createLightNode | typeof createRelayNode;
};

export async function runNodes<T>(
  options: RunNodesOptions
): Promise<[ServiceNode, T]> {
  const { context, networkConfig, createNode, protocols } = options;

  const nwaku = new ServiceNode(makeLogFileName(context));

  const nwakuArgs: Args = {
    filter: true,
    lightpush: true,
    relay: true,
    store: true,
    clusterId: networkConfig.clusterId
  };

  const jswakuArgs: CreateNodeOptions = {
    staticNoiseKey: NOISE_KEY_1,
    libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    networkConfig,
    lightPush: { numPeersToUse: 2 },
    discovery: DEFAULT_DISCOVERIES_ENABLED
  };

  const routingInfos: RoutingInfo[] = [];
  if (isAutoSharding(networkConfig)) {
    nwakuArgs.numShardsInNetwork = networkConfig.numShardsInCluster;
    nwakuArgs.contentTopic = options.contentTopics ?? [];

    nwakuArgs.contentTopic.map((ct) =>
      routingInfos.push(createRoutingInfo(networkConfig, { contentTopic: ct }))
    );

    if (options.relayShards && options.relayShards.length > 0)
      throw "`relayShards` cannot be set for auto-sharding";
  } else if (isStaticSharding(networkConfig) && options.relayShards) {
    const shards = options.relayShards;
    nwakuArgs.shard = shards;
    nwakuArgs.numShardsInNetwork = 0;

    shards.map((shardId) =>
      routingInfos.push(createRoutingInfo(networkConfig, { shardId }))
    );

    if (options.contentTopics && options.contentTopics.length > 0)
      throw "`contentTopics` cannot be set for static sharding";
  } else {
    throw "Invalid Network Config";
  }

  const jswakuRelayCreateOptions: RelayCreateOptions = {
    routingInfos
  };

  await nwaku.start(nwakuArgs, { retries: 3 });

  log.info("Starting js waku node with :", JSON.stringify(jswakuArgs));
  let waku: WakuNode | undefined;
  try {
    waku = (await createNode({
      ...jswakuArgs,
      ...jswakuRelayCreateOptions
    })) as unknown as WakuNode;
    await waku.start();
  } catch (error) {
    log.error("jswaku node failed to start:", error);
  }

  if (waku) {
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForPeers(protocols);

    await nwaku.ensureSubscriptions(routingInfos.map((r) => r.pubsubTopic));

    return [nwaku, waku as T];
  } else {
    throw new Error("Failed to initialize waku");
  }
}
