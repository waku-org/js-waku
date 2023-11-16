import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import type { PeerDiscovery } from "@libp2p/interface/peer-discovery";
import { mplex } from "@libp2p/mplex";
import { webSockets } from "@libp2p/websockets";
import { all as filterAll } from "@libp2p/websockets/filters";
import {
  DefaultPubsubTopic,
  DefaultUserAgent,
  wakuFilter,
  wakuLightPush,
  WakuNode,
  WakuOptions,
  wakuStore
} from "@waku/core";
import { enrTree, wakuDnsDiscovery } from "@waku/dns-discovery";
import type {
  FullNode,
  Libp2p,
  Libp2pComponents,
  LightNode,
  ProtocolCreateOptions,
  RelayNode
} from "@waku/interfaces";
import type { PubsubTopic } from "@waku/interfaces";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
import { RelayCreateOptions, wakuGossipSub, wakuRelay } from "@waku/relay";
import { shardInfoToPubsubTopics } from "@waku/utils";
import { createLibp2p, Libp2pOptions } from "libp2p";
import { identifyService } from "libp2p/identify";
import { pingService } from "libp2p/ping";

const DEFAULT_NODE_REQUIREMENTS = {
  lightPush: 1,
  filter: 1,
  store: 1
};

export { Libp2pComponents };

/**
 * Create a Waku node that uses Waku Light Push, Filter and Store to send and
 * receive messages, enabling low resource consumption.
 * Uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options?: ProtocolCreateOptions & WakuOptions
): Promise<LightNode> {
  options = options ?? {};

  let pubsubTopics: PubsubTopic[];

  if (!options.shardInfo) {
    pubsubTopics = [DefaultPubsubTopic];
  } else {
    pubsubTopics = shardInfoToPubsubTopics(options.shardInfo);
  }

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    undefined,
    libp2pOptions,
    options?.userAgent
  );

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);

  return new WakuNode(
    options ?? {},
    pubsubTopics,
    libp2p,
    store,
    lightPush,
    filter
  ) as LightNode;
}

/**
 * Create a Waku node that uses Waku Relay to send and receive messages,
 * enabling some privacy preserving properties.
 */
export async function createRelayNode(
  options?: ProtocolCreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<RelayNode> {
  options = options ?? {};

  let pubsubTopics: PubsubTopic[];

  if (!options.shardInfo) {
    pubsubTopics = [DefaultPubsubTopic];
  } else {
    pubsubTopics = shardInfoToPubsubTopics(options.shardInfo);
  }

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    wakuGossipSub(options),
    libp2pOptions,
    options?.userAgent
  );

  const relay = wakuRelay(options);

  return new WakuNode(
    options,
    pubsubTopics,
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
  options?: ProtocolCreateOptions & WakuOptions & Partial<RelayCreateOptions>
): Promise<FullNode> {
  options = options ?? {};

  let pubsubTopics: PubsubTopic[];

  if (!options.shardInfo) {
    pubsubTopics = [DefaultPubsubTopic];
  } else {
    pubsubTopics = shardInfoToPubsubTopics(options.shardInfo);
  }

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];
  if (options?.defaultBootstrap) {
    peerDiscovery.push(...defaultPeerDiscoveries());
    Object.assign(libp2pOptions, { peerDiscovery });
  }

  const libp2p = await defaultLibp2p(
    wakuGossipSub(options),
    libp2pOptions,
    options?.userAgent
  );

  const store = wakuStore(options);
  const lightPush = wakuLightPush(options);
  const filter = wakuFilter(options);
  const relay = wakuRelay(options);

  return new WakuNode(
    options ?? {},
    pubsubTopics,
    libp2p,
    store,
    lightPush,
    filter,
    relay
  ) as FullNode;
}

export function defaultPeerDiscoveries(): ((
  components: Libp2pComponents
) => PeerDiscovery)[] {
  const discoveries = [
    wakuDnsDiscovery([enrTree["PROD"]], DEFAULT_NODE_REQUIREMENTS),
    wakuPeerExchangeDiscovery()
  ];
  return discoveries;
}

type PubsubService = {
  pubsub?: (components: Libp2pComponents) => GossipSub;
};

export async function defaultLibp2p(
  wakuGossipSub?: PubsubService["pubsub"],
  options?: Partial<Libp2pOptions>,
  userAgent?: string
): Promise<Libp2p> {
  const pubsubService: PubsubService = wakuGossipSub
    ? { pubsub: wakuGossipSub }
    : {};

  return createLibp2p({
    connectionManager: {
      minConnections: 1
    },
    transports: [webSockets({ filter: filterAll })],
    streamMuxers: [mplex()],
    connectionEncryption: [noise()],
    ...options,
    services: {
      identify: identifyService({
        agentVersion: userAgent ?? DefaultUserAgent
      }),
      ping: pingService(),
      ...pubsubService,
      ...options?.services
    }
  }) as any as Libp2p; // TODO: make libp2p include it;
}
