import type { PeerId } from "@libp2p/interface/peer-id";
import type { Peer } from "@libp2p/interface/peer-store";
import type { EventEmitter } from "@libp2p/interfaces/events";

export enum Tags {
  BOOTSTRAP = "bootstrap",
  PEER_EXCHANGE = "peer-exchange"
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

export enum EPeersByDiscoveryEvents {
  PEER_DISCOVERY_BOOTSTRAP = "peer:discovery:bootstrap",
  PEER_DISCOVERY_PEER_EXCHANGE = "peer:discovery:peer-exchange",
  PEER_CONNECT_BOOTSTRAP = "peer:connected:bootstrap",
  PEER_CONNECT_PEER_EXCHANGE = "peer:connected:peer-exchange"
}

export interface IPeersByDiscoveryEvents {
  [EPeersByDiscoveryEvents.PEER_DISCOVERY_BOOTSTRAP]: CustomEvent<PeerId>;
  [EPeersByDiscoveryEvents.PEER_DISCOVERY_PEER_EXCHANGE]: CustomEvent<PeerId>;
  [EPeersByDiscoveryEvents.PEER_CONNECT_BOOTSTRAP]: CustomEvent<PeerId>;
  [EPeersByDiscoveryEvents.PEER_CONNECT_PEER_EXCHANGE]: CustomEvent<PeerId>;
}

export interface PeersByDiscoveryResult {
  DISCOVERED: {
    [Tags.BOOTSTRAP]: Peer[];
    [Tags.PEER_EXCHANGE]: Peer[];
  };
  CONNECTED: {
    [Tags.BOOTSTRAP]: Peer[];
    [Tags.PEER_EXCHANGE]: Peer[];
  };
}

export enum EConnectionStateEvents {
  CONNECTION_STATUS = "waku:connection"
}

export interface IConnectionStateEvents {
  // true when online, false when offline
  [EConnectionStateEvents.CONNECTION_STATUS]: CustomEvent<boolean>;
}

export interface IConnectionManager
  extends EventEmitter<IPeersByDiscoveryEvents & IConnectionStateEvents> {
  getPeersByDiscovery(): Promise<PeersByDiscoveryResult>;
  stop(): void;
}
