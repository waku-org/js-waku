import type { GossipSub } from "@chainsafe/libp2p-gossipsub";

import type {
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
} from "./message.js";
import type { Callback, SendResult } from "./protocols.js";

export type Observer<T extends IDecodedMessage> = {
  decoder: IDecoder<T>;
  callback: Callback<T>;
};

export interface IRelay extends GossipSub {
  send: (encoder: IEncoder, message: IMessage) => Promise<SendResult>;
  addObserver: <T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ) => () => void;
  observers: Map<string, Set<Observer<any>>>;
  getMeshPeers: () => string[];
}
