import type { Peer, PeerId, Stream } from "@libp2p/interface";
import type { MultiaddrInput } from "@multiformats/multiaddr";

import type { PubsubTopic } from "./misc.js";

export enum Tags {
  BOOTSTRAP = "bootstrap",
  PEER_EXCHANGE = "peer-exchange",
  LOCAL = "local-peer-cache"
}

export type ConnectionManagerOptions = {
  /**
   * Max number of bootstrap peers allowed to be connected to initially.
   * This is used to increase intention of dialing non-bootstrap peers, found using other discovery mechanisms (like Peer Exchange).
   *
   * @default 1
   */
  maxBootstrapPeers: number;

  /**
   * Keep alive libp2p pings interval in seconds.
   *
   * @default 300 seconds
   */
  pingKeepAlive: number;

  /**
   * Gossip sub specific keep alive interval in seconds.
   *
   * @default 300 seconds
   */
  relayKeepAlive: number;
};

export interface IConnectionManager {
  start(): void;
  stop(): void;
  dial(
    peer: PeerId | MultiaddrInput,
    protocolCodecs: string[]
  ): Promise<Stream>;
  hangUp(peer: PeerId | MultiaddrInput): Promise<boolean>;
  getConnectedPeers(codec?: string): Promise<Peer[]>;
  isTopicConfigured(pubsubTopic: PubsubTopic): boolean;
}
