import { noise } from "@chainsafe/libp2p-noise";
import { bootstrap } from "@libp2p/bootstrap";
import { identify } from "@libp2p/identify";
import { mplex } from "@libp2p/mplex";
import { ping } from "@libp2p/ping";
import { webSockets } from "@libp2p/websockets";
import { WebSockets, WebSocketsSecure } from "@multiformats/multiaddr-matcher";
import { wakuMetadata } from "@waku/core";
import {
  type ClusterId,
  type CreateLibp2pOptions,
  type CreateNodeOptions,
  DEFAULT_CLUSTER_ID,
  DefaultNetworkConfig,
  type Libp2p
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { createLibp2p } from "libp2p";

import { isTestEnvironment } from "../env.js";

import { getPeerDiscoveries } from "./discovery.js";

const log = new Logger("sdk:create");

const DefaultUserAgent = "js-waku";
const DefaultPingMaxInboundStreams = 10;

export async function defaultLibp2p(
  clusterId: ClusterId,
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

  // Create connection gater that replaces deprecated websocket filters
  const allowWsConnections =
    options?.filterMultiaddrs === false || isTestEnvironment();

  return createLibp2p({
    transports: [webSockets()],
    streamMuxers: [mplex()],
    connectionEncrypters: [noise()],
    ...options,
    connectionGater: {
      denyDialMultiaddr: async (multiaddr) => {
        // Allow WSS (secure websockets) connections
        if (WebSocketsSecure.matches(multiaddr)) {
          return false;
        }

        // Allow WS (non-secure websockets) only if explicitly enabled
        if (WebSockets.matches(multiaddr)) {
          return !allowWsConnections;
        }

        // Allow all other types of connections
        return false;
      },
      ...options?.connectionGater
    },
    services: {
      identify: identify({
        agentVersion: userAgent ?? DefaultUserAgent
      }),
      ping: ping({
        maxInboundStreams:
          options?.pingMaxInboundStreams ?? DefaultPingMaxInboundStreams
      }),
      metadata: wakuMetadata(clusterId),
      ...options?.services
    }
  }) as any as Libp2p; // TODO: make libp2p include it;
}

export async function createLibp2pAndUpdateOptions(
  options: CreateNodeOptions
): Promise<Libp2p> {
  const networkConfig = options.networkConfig ?? DefaultNetworkConfig;
  const clusterId = networkConfig.clusterId ?? DEFAULT_CLUSTER_ID;

  log.info("Creating Waku node with cluster id: ", clusterId);

  const libp2pOptions = options?.libp2p ?? {};
  const peerDiscovery = libp2pOptions.peerDiscovery ?? [];

  if (options?.defaultBootstrap) {
    peerDiscovery.push(
      ...getPeerDiscoveries(
        {
          dns: true,
          peerExchange: true,
          peerCache: true,
          ...options.discovery
        },
        options.peerCache
      )
    );
  } else {
    peerDiscovery.push(
      ...getPeerDiscoveries(options.discovery, options.peerCache)
    );
  }

  const bootstrapPeers = [
    ...(options.bootstrapPeers || []),
    ...(options.store?.peers || [])
  ];

  if (bootstrapPeers.length) {
    peerDiscovery.push(bootstrap({ list: bootstrapPeers }));
  }

  libp2pOptions.peerDiscovery = peerDiscovery;

  return defaultLibp2p(clusterId, libp2pOptions, options?.userAgent);
}
