import { ConnectionManager } from "@waku/core";
import { FilterCore } from "@waku/core";
import type { Libp2p, NextFilterOptions } from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";

import { NewPeerManager } from "../peer_manager/index.js";

export type FilterConstructorParams = {
  options?: Partial<NextFilterOptions>;
  libp2p: Libp2p;
  peerManager: NewPeerManager;
  connectionManager: ConnectionManager;
};

export type SubscriptionEvents = {
  [contentTopic: string]: CustomEvent<WakuMessage>;
};

export type SubscriptionParams = {
  libp2p: Libp2p;
  pubsubTopic: string;
  protocol: FilterCore;
  config: NextFilterOptions;
  peerManager: NewPeerManager;
};
