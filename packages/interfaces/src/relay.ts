import type { GossipSub, GossipsubEvents } from "@chainsafe/libp2p-gossipsub";
import type { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";

import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
} from "./message.js";
import type { Callback, SendResult } from "./protocols.js";

export interface RelayEvents {
  "observer:added": CustomEvent;
  "observer:removed": CustomEvent;
}

type IRelayEmitter = EventEmitter<RelayEvents & GossipsubEvents>;

interface IRelayAPI extends GossipSub {
  send: (encoder: IEncoder, message: IMessage) => Promise<SendResult>;
  addObserver: <T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ) => () => void;
  getMeshPeers: () => string[];
}

export type IRelay = IRelayAPI & IRelayEmitter;
