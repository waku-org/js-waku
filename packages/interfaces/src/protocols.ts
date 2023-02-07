import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";

import type { IMessage } from "./message.js";

export enum Protocols {
  Relay = "relay",
  Store = "store",
  LightPush = "lightpush",
  Filter = "filter",
  PeerExchange = "peer-exchange",
}

export interface PointToPointProtocol {
  multicodec: string;
  peerStore: PeerStore;
  peers: () => Promise<Peer[]>;
}

export type ProtocolCreateOptions = {
  /**
   * The PubSub Topic to use. Defaults to {@link @waku/core/DefaultPubSubTopic }.
   *
   * One and only one pubsub topic is used by Waku. This is used by:
   * - WakuRelay to receive, route and send messages,
   * - WakuLightPush to send messages,
   * - WakuStore to retrieve messages.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   */
  pubSubTopic?: string;
};

//TODO
// we can probably move `peerId` into `ProtocolCreateOptions` and remove `ProtocolOptions` and pass it in the constructor
// however, filter protocol can use multiple peers, so we need to think about this
export type ProtocolOptions = {
  /**
   * Optionally specify an PeerId for the protocol request. If not included, will use a random peer.
   */
  peerId?: PeerId;
};

export type Callback<T extends IMessage> = (msg: T) => void | Promise<void>;

export interface SendResult {
  recipients: PeerId[];
}
