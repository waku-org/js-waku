import type { GossipSub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub";
import type { EventEmitter } from "@libp2p/interfaces/events";

import type { IDecodedMessage, IDecoder } from "./message.js";
import type { Callback } from "./protocols.js";
import type { ISender } from "./sender.js";

export interface RelayEvents {
  "observer:added": CustomEvent;
  "observer:removed": CustomEvent;
}

type IRelayEmitter = EventEmitter<RelayEvents & GossipsubEvents>;

interface IRelayAPI {
  addObserver: <T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ) => () => void;
  getMeshPeers: () => string[];
}

export type IRelay = ISender & GossipSub & IRelayAPI & IRelayEmitter;
