import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";

import { IReceiver } from "./receiver";
import type { ISender } from "./sender";

/**
 * Interface representing the Relay API, providing control and information about the GossipSub protocol.
 *
 * @property gossipSub - The GossipSub instance used for managing pub/sub behavior.
 * @property start - Function to start the relay, returning a Promise that resolves when initialization is complete.
 * @property getMeshPeers - Function to retrieve the mesh peers for a given topic or all topics if none is specified. Returns an array of peer IDs as strings.
 */
export interface IRelayAPI {
  readonly gossipSub: GossipSub;
  start: () => Promise<void>;
  getMeshPeers: (topic?: TopicStr) => PeerIdStr[];
}

export type IRelay = IRelayAPI & ISender & IReceiver;
