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
   * Number of attempts before a peer is considered non-dialable.
   * This is used to not spam a peer with dial attempts when it is not dialable.
   *
   * @default 3
   */
  maxDialAttemptsForPeer: number;

  /**
   * Max number of bootstrap peers allowed to be connected to initially.
   * This is used to increase intention of dialing non-bootstrap peers, found using other discovery mechanisms (like Peer Exchange).
   *
   * @default 1
   */
  maxBootstrapPeersAllowed: number;

  /**
   * Max number of parallel dials allowed.
   *
   * @default 3
   */
  maxParallelDials: number;

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

export interface PeersByDiscoveryResult {
  DISCOVERED: {
    [Tags.BOOTSTRAP]: Peer[];
    [Tags.PEER_EXCHANGE]: Peer[];
    [Tags.LOCAL]: Peer[];
  };
  CONNECTED: {
    [Tags.BOOTSTRAP]: Peer[];
    [Tags.PEER_EXCHANGE]: Peer[];
    [Tags.LOCAL]: Peer[];
  };
}

export interface IConnectionManager {
  start(): void;
  stop(): void;
  dial(
    peer: PeerId | MultiaddrInput,
    protocolCodecs: string[]
  ): Promise<Stream>;
  hangUp(peer: PeerId | MultiaddrInput): Promise<boolean>;
  isPubsubTopicConfigured(pubsubTopic: PubsubTopic): boolean;
  getConnectedPeers(codec?: string): Promise<Peer[]>;
}
