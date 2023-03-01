import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";

import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
} from "./message.js";
import type { Callback, SendResult } from "./protocols.js";

export interface WakuEvents {
  "observer:added": CustomEvent;
  "observer:removed": CustomEvent;
}

type IRelayEmitter = EventEmitter<WakuEvents>;

interface IRelayAPI extends GossipSub {
  send: (encoder: IEncoder, message: IMessage) => Promise<SendResult>;
  addObserver: <T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ) => () => void;
  getMeshPeers: () => string[];
}

export type IRelay = IRelayAPI & IRelayEmitter;
