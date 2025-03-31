import { ConnectionManager } from "@waku/core";
import { FilterCore } from "@waku/core";
import type {
  Callback,
  IDecodedMessage,
  IDecoder,
  Libp2p
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";

import { PeerManager } from "../peer_manager.js";

export type IFilter = {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): void;

  unsubscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): void;
};

export type FilterOptions = {
  /**
   * Interval with which Filter subscription will attempt to send ping requests to subscribed peers.
   *
   * @default 60_000
   */
  keepAliveIntervalMs: number;
  /**
   * Number of failed pings allowed to make to a remote peer before attempting to subscribe to a new one.
   *
   * @default 3
   */
  pingsBeforePeerRenewed: number;
  numPeersToUse: number;
};

export type FilterConstructorParams = {
  options?: Partial<FilterOptions>;
  libp2p: Libp2p;
  peerManager: PeerManager;
  connectionManager: ConnectionManager;
};

export type PubsubTopic = string;

export type PubsubSubscriptionEvents = {
  [key: string]: CustomEvent<WakuMessage>;
};

export type PubsubSubscriptionParams = {
  libp2p: Libp2p;
  pubsubTopic: string;
  protocol: FilterCore;
  config: FilterOptions;
  peerManager: PeerManager;
};
