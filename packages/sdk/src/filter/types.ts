import type { FilterCore } from "@waku/core";
import type {
  FilterProtocolOptions,
  IDecodedMessage,
  Libp2p
} from "@waku/interfaces";

import type { PeerManager } from "../peer_manager/index.js";

export type FilterConstructorParams = {
  options?: Partial<FilterProtocolOptions>;
  libp2p: Libp2p;
  peerManager: PeerManager;
};

export type SubscriptionEvents = {
  [contentTopic: string]: CustomEvent<IDecodedMessage>;
};

export type SubscriptionParams = {
  pubsubTopic: string;
  protocol: FilterCore;
  config: FilterProtocolOptions;
  peerManager: PeerManager;
};
