import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";

import type { PubsubTopic } from "./misc.js";
import type { IReceiver } from "./receiver.js";
import type { ISender } from "./sender.js";

/**
 * Interface representing the Relay API, providing control and information about the GossipSub protocol.
 *
 * @property gossipSub - The GossipSub instance used for managing pub/sub behavior.
 * @property start - Function to start the relay, returning a Promise that resolves when initialization is complete.
 * @property getMeshPeers - Function to retrieve the mesh peers for a given topic or all topics if none is specified. Returns an array of peer IDs as strings.
 */
export interface IRelayAPI {
  readonly pubsubTopics: Set<PubsubTopic>;
  readonly gossipSub: GossipSub;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  waitForPeers: () => Promise<void>;
  getMeshPeers: (topic?: TopicStr) => PeerIdStr[];
}

export type IRelay = IRelayAPI & ISender & IReceiver;
