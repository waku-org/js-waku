import type { FilterCore } from "@waku/core";
import type { FilterProtocolOptions, Libp2p } from "@waku/interfaces";
import type { WakuMessage } from "@waku/proto";

import type { PeerManager } from "../peer_manager/index.js";

export type FilterConstructorParams = {
  options?: Partial<FilterProtocolOptions>;
  libp2p: Libp2p;
  peerManager: PeerManager;
};

export type SubscriptionEvents = {
  [contentTopic: string]: CustomEvent<WakuMessage>;
};

export type SubscriptionParams = {
  pubsubTopic: string;
  protocol: FilterCore;
  config: FilterProtocolOptions;
  peerManager: PeerManager;
};
