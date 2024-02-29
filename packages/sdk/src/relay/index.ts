import { wakuFilter, wakuLightPush, wakuStore } from "@waku/core";
import {
  DefaultPubsubTopic,
  type FullNode,
  type ProtocolCreateOptions,
  type RelayNode
} from "@waku/interfaces";
import { RelayCreateOptions, wakuGossipSub, wakuRelay } from "@waku/relay";
import { ensureShardingConfigured } from "@waku/utils";

import { defaultPeerDiscoveries } from "../create.js";
import { defaultLibp2p } from "../utils/libp2p.js";
import { WakuNode, WakuOptions } from "../waku.js";

/**
 * Create a Waku node that uses Waku Relay to send and receive messages,
 * enabling some privacy preserving properties.
 * * @remarks
 * This function creates a Relay Node using the Waku Relay protocol.
 * While it is technically possible to use this function in a browser environment,
 * it is not recommended due to potential performance issues and limited browser capabilities.
 * If you are developing a browser-based application, consider alternative approaches like creating a Light Node
 * or use this function with caution.
 */
export async function createRelayNode(
  options?: ProtocolCreateOptions &
    Partial<WakuOptions> &
    Partial<RelayCreateOptions>
): Promise<RelayNode> {
  options = options ?? { pubsubTopics: [] };

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];

  const shardInfo = options.shardInfo
    ? ensureShardingConfigured(options.shardInfo)
    : undefined;

  options.pubsubTopics = shardInfo?.pubsubTopics ??
    options.pubsubTopics ?? [DefaultPubsubTopic];

  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries(options.pubsubTopics));
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    shardInfo?.shardInfo,
    wakuGossipSub(options),
    libp2pOptions,
    options?.userAgent
  );

  const relay = wakuRelay(options.pubsubTopics);

  return new WakuNode(
    options as WakuOptions,
    libp2p,
    undefined,
    undefined,
    undefined,
    relay
  ) as RelayNode;
}

/**
 * Create a Waku node that uses all Waku protocols.
 *
 * This helper is not recommended except if:
 * - you are interfacing with nwaku v0.11 or below
 * - you are doing some form of testing
 *
 * If you are building a full node, it is recommended to use
 * [nwaku](github.com/status-im/nwaku) and its JSON RPC API or wip REST API.
 *
 * @see https://github.com/status-im/nwaku/issues/1085
 * @internal
 */
export async function createFullNode(
  options?: ProtocolCreateOptions &
    Partial<WakuOptions> &
    Partial<RelayCreateOptions>
): Promise<FullNode> {
  options = options ?? { pubsubTopics: [] };

  const shardInfo = options.shardInfo
    ? ensureShardingConfigured(options.shardInfo)
    : undefined;

  const pubsubTopics = shardInfo?.pubsubTopics ??
    options.pubsubTopics ?? [DefaultPubsubTopic];
  options.pubsubTopics = pubsubTopics;
  options.shardInfo = shardInfo?.shardInfo;

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries(pubsubTopics));
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    shardInfo?.shardInfo,
    wakuGossipSub(options),
    libp2pOptions,
    options?.userAgent
  );

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);
  const relay = wakuRelay(pubsubTopics);

  return new WakuNode(
    options as WakuOptions,
    libp2p,
    store,
    lightPush,
    filter,
    relay
  ) as FullNode;
}
