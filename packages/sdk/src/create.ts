import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { identify } from "@libp2p/identify";
import type { PeerDiscovery } from "@libp2p/interface";
import { mplex } from "@libp2p/mplex";
import { ping } from "@libp2p/ping";
import { webSockets } from "@libp2p/websockets";
import { all as filterAll } from "@libp2p/websockets/filters";
import {
  DefaultUserAgent,
  wakuFilter,
  wakuLightPush,
  wakuMetadata,
  WakuNode,
  WakuOptions,
  wakuStore
} from "@waku/core";
import {
  enrTree,
  wakuDnsDiscovery,
  wakuLocalStorageDiscovery,
  wakuPeerExchangeDiscovery
} from "@waku/discovery";
import {
  type CreateLibp2pOptions,
  DefaultPubsubTopic,
  type FullNode,
  type IMetadata,
  type Libp2p,
  type Libp2pComponents,
  type LightNode,
  type ProtocolCreateOptions,
  PubsubTopic,
  type ShardInfo
} from "@waku/interfaces";
import { RelayCreateOptions, wakuGossipSub, wakuRelay } from "@waku/relay";
import { ensureShardingConfigured } from "@waku/utils";
import { createLibp2p } from "libp2p";

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
  options?: ProtocolCreateOptions &
    Partial<WakuOptions> &
    Partial<RelayCreateOptions>
): Promise<LightNode> {
  options = options ?? { pubsubTopics: [] };

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
    wakuGossipSub(options),
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
  options?: ProtocolCreateOptions & Partial<WakuOptions>
): Promise<LightNode> {
  options = options ?? {};

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
    wakuGossipSub(options),
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

export function defaultPeerDiscoveries(
  pubsubTopics: PubsubTopic[]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  const discoveries = [
    wakuDnsDiscovery([enrTree["PROD"]], DEFAULT_NODE_REQUIREMENTS),
    wakuLocalStorageDiscovery(),
    wakuPeerExchangeDiscovery(pubsubTopics)
  ];
  return discoveries;
}

type PubsubService = {
  pubsub?: (components: Libp2pComponents) => GossipSub;
};

type MetadataService = {
  metadata?: (components: Libp2pComponents) => IMetadata;
};

export async function defaultLibp2p(
  shardInfo?: ShardInfo,
  wakuGossipSub?: PubsubService["pubsub"],
  options?: Partial<CreateLibp2pOptions>,
  userAgent?: string
): Promise<Libp2p> {
  if (!options?.hideWebSocketInfo && process.env.NODE_ENV !== "test") {
    /* eslint-disable no-console */
    console.info(
      "%cIgnore WebSocket connection failures",
      "background: gray; color: white; font-size: x-large"
    );
    console.info(
      "%cWaku tries to discover peers and some of them are expected to fail",
      "background: gray; color: white; font-size: x-large"
    );
    /* eslint-enable no-console */
  }

  const pubsubService: PubsubService = wakuGossipSub
    ? { pubsub: wakuGossipSub }
    : {};

  const metadataService: MetadataService = shardInfo
    ? { metadata: wakuMetadata(shardInfo) }
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
      identify: identify({
        agentVersion: userAgent ?? DefaultUserAgent
      }),
      ping: ping(),
      ...metadataService,
      ...pubsubService,
      ...options?.services
    }
  }) as any as Libp2p; // TODO: make libp2p include it;
}
