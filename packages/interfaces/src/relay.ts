import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";

import { IReceiver } from "./receiver.js";
import type { ISender } from "./sender.js";

interface IRelayAPI {
  readonly gossipSub: GossipSub;
  start: () => Promise<void>;
  getMeshPeers: (topic?: TopicStr) => PeerIdStr[];
}

export type IRelay = IRelayAPI & ISender & IReceiver;
