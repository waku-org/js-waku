import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { noise } from "@chainsafe/libp2p-noise";
import { identify } from "@libp2p/identify";
import { mplex } from "@libp2p/mplex";
import { ping } from "@libp2p/ping";
import { webSockets } from "@libp2p/websockets";
import { all as filterAll } from "@libp2p/websockets/filters";
import { wakuMetadata } from "@waku/core";
import {
  type CreateLibp2pOptions,
  type IMetadata,
  type Libp2p,
  type Libp2pComponents,
  type ShardInfo
} from "@waku/interfaces";
import { createLibp2p } from "libp2p";

import { DefaultUserAgent } from "../waku.js";

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
