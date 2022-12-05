import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";

import type { Message } from "./message.js";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter",
  PeerExchange = "peer-exchange",
}

export interface PointToPointProtocol {
  peerStore: PeerStore;
  peers: () => Promise<Peer[]>;
}

export type ProtocolOptions = {
  pubSubTopic?: string;
  /**
   * Optionally specify an PeerId for the protocol request. If not included, will use a random peer.
   */
  peerId?: PeerId;
};

export type Callback<T extends Message> = (msg: T) => void | Promise<void>;

export interface SendResult {
  recipients: PeerId[];
}
