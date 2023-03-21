import type { GossipSub } from "@chainsafe/libp2p-gossipsub";

import type { IDecodedMessage, IDecoder } from "./message.js";
import type { Callback } from "./protocols.js";
import type { ISender } from "./sender.js";

type PubSubTopic = string;
type ContentTopic = string;

export type ActiveSubscriptions = Map<PubSubTopic, ContentTopic[]>;

export interface IRelayAPI {
  addObserver: <T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ) => () => void;
  getMeshPeers: () => string[];
  getActiveSubscriptions: () => ActiveSubscriptions | undefined;
}

export type IRelay = IRelayAPI & GossipSub & ISender;
