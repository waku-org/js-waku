import {
  DefaultPubsubTopic,
  type ProtocolCreateOptions,
  type RelayNode
} from "@waku/interfaces";
import { RelayCreateOptions, wakuGossipSub, wakuRelay } from "@waku/relay";
import { ensureShardingConfigured } from "@waku/utils";

import { defaultLibp2p, defaultPeerDiscoveries } from "../create.js";
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
