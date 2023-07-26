import type { Peer } from "@libp2p/interface-peer-store";

export enum Tags {
  BOOTSTRAP = "bootstrap",
  PEER_EXCHANGE = "peer-exchange",
}

export interface ConnectionManagerOptions {
  /**
   * Number of attempts before a peer is considered non-dialable
   * This is used to not spam a peer with dial attempts when it is not dialable
   */
  maxDialAttemptsForPeer: number;
  /**
   * Max number of bootstrap peers allowed to be connected to, initially
   * This is used to increase intention of dialing non-bootstrap peers, found using other discovery mechanisms (like Peer Exchange)
   */
  maxBootstrapPeersAllowed: number;
  /**
   * Max number of parallel dials allowed
   */
  maxParallelDials: number;
}

export interface PeersByDiscovery {
  DISCOVERED: {
    [Tags.BOOTSTRAP]: Peer[];
    [Tags.PEER_EXCHANGE]: Peer[];
  };
  CONNECTED: {
    [Tags.BOOTSTRAP]: Peer[];
    [Tags.PEER_EXCHANGE]: Peer[];
  };
}
