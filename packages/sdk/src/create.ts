import type { PeerDiscovery } from "@libp2p/interface";
import { wakuFilter, wakuLightPush, wakuStore } from "@waku/core";
import { enrTree, wakuDnsDiscovery } from "@waku/dns-discovery";
import {
  DefaultPubsubTopic,
  type Libp2pComponents,
  type LightNode,
  PubsubTopic
} from "@waku/interfaces";
import { wakuLocalPeerCacheDiscovery } from "@waku/local-peer-cache-discovery";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
import { ensureShardingConfigured } from "@waku/utils";

import { defaultLibp2p } from "./utils/libp2p.js";
import { CreateWakuNodeOptions, WakuNode, WakuOptions } from "./waku.js";

const DEFAULT_NODE_REQUIREMENTS = {
  lightPush: 1,
  filter: 1,
  store: 1
};

export { Libp2pComponents };

/**
 * Create a Waku node configured to use autosharding or static sharding.
 */
export async function createNode(
  options: CreateWakuNodeOptions = { pubsubTopics: [] }
): Promise<LightNode> {
  if (!options.shardInfo) {
    throw new Error("Shard info must be set");
  }

  const shardInfo = ensureShardingConfigured(options.shardInfo);
  options.pubsubTopics = shardInfo.pubsubTopics;
  options.shardInfo = shardInfo.shardInfo;

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries(shardInfo.pubsubTopics));
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    shardInfo.shardInfo,
    undefined,
    libp2pOptions,
    options?.userAgent
  );

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);

  return new WakuNode(
    options as WakuOptions,
    libp2p,
    store,
    lightPush,
    filter
  ) as LightNode;
}

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * Uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options: CreateWakuNodeOptions = {}
): Promise<LightNode> {
  const shardInfo = options.shardInfo
    ? ensureShardingConfigured(options.shardInfo)
    : undefined;

  options.pubsubTopics = shardInfo?.pubsubTopics ??
    options.pubsubTopics ?? [DefaultPubsubTopic];

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries(options.pubsubTopics));
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    shardInfo?.shardInfo,
    undefined,
    libp2pOptions,
    options?.userAgent
  );

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);

  return new WakuNode(
    options as WakuOptions,
    libp2p,
    store,
    lightPush,
    filter
  ) as LightNode;
}

export function defaultPeerDiscoveries(
  pubsubTopics: PubsubTopic[]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const discoveries = [
    wakuDnsDiscovery([enrTree["PROD"]], DEFAULT_NODE_REQUIREMENTS),
    wakuLocalPeerCacheDiscovery(),
    wakuPeerExchangeDiscovery(pubsubTopics)
  ];
  return discoveries;
}
