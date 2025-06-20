import { noise } from "@chainsafe/libp2p-noise";
import { bootstrap } from "@libp2p/bootstrap";
import { identify } from "@libp2p/identify";
import { mplex } from "@libp2p/mplex";
import { ping } from "@libp2p/ping";
import { webSockets } from "@libp2p/websockets";
import { all as filterAll, wss } from "@libp2p/websockets/filters";
import { wakuMetadata } from "@waku/core";
import {
  type CreateLibp2pOptions,
  type CreateNodeOptions,
  DefaultNetworkConfig,
  type IMetadata,
  type Libp2p,
  type Libp2pComponents,
  PubsubTopic
} from "@waku/interfaces";
import { derivePubsubTopicsFromNetworkConfig, Logger } from "@waku/utils";
import { createLibp2p } from "libp2p";

import { isTestEnvironment } from "../env.js";

import { getPeerDiscoveries } from "./discovery.js";

type MetadataService = {
  metadata?: (components: Libp2pComponents) => IMetadata;
};

const log = new Logger("sdk:create");

const DefaultUserAgent = "js-waku";
const DefaultPingMaxInboundStreams = 10;

export async function defaultLibp2p(
  pubsubTopics: PubsubTopic[],
  options?: Partial<CreateLibp2pOptions>,
  userAgent?: string
): Promise<Libp2p> {
  if (!options?.hideWebSocketInfo && !isTestEnvironment()) {
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

  const metadataService: MetadataService = pubsubTopics
    ? { metadata: wakuMetadata(pubsubTopics) }
    : {};

  const filter =
    options?.filterMultiaddrs === false || isTestEnvironment()
      ? filterAll
      : wss;

  return createLibp2p({
    transports: [webSockets({ filter: filter })],
    streamMuxers: [mplex()],
    connectionEncrypters: [noise()],
    ...options,
    services: {
      identify: identify({
        agentVersion: userAgent ?? DefaultUserAgent
      }),
      ping: ping({
        maxInboundStreams:
          options?.pingMaxInboundStreams ?? DefaultPingMaxInboundStreams
      }),
      ...metadataService,
      ...options?.services
    }
  }) as any as Libp2p; // TODO: make libp2p include it;
}

const DEFAULT_DISCOVERIES_ENABLED = {
  dns: true,
  peerExchange: true,
  localPeerCache: true
};

export async function createLibp2pAndUpdateOptions(
  options: CreateNodeOptions
): Promise<{ libp2p: Libp2p; pubsubTopics: PubsubTopic[] }> {
  const { networkConfig } = options;
  const pubsubTopics = derivePubsubTopicsFromNetworkConfig(
    networkConfig ?? DefaultNetworkConfig
  );
  log.info("Creating Waku node with pubsub topics", pubsubTopics);

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];

  if (options?.defaultBootstrap) {
    peerDiscovery.push(
      ...getPeerDiscoveries({
        ...DEFAULT_DISCOVERIES_ENABLED,
        ...options.discovery
      })
    );
  } else {
    peerDiscovery.push(...getPeerDiscoveries(options.discovery));
  }

  if (options?.bootstrapPeers) {
    peerDiscovery.push(bootstrap({ list: options.bootstrapPeers }));
  }

  libp2pOptions.peerDiscovery = peerDiscovery;

  const libp2p = await defaultLibp2p(
    pubsubTopics,
    libp2pOptions,
    options?.userAgent
  );

  return { libp2p, pubsubTopics };
}
