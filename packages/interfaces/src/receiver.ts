import type { IDecodedMessage, IDecoder } from "./message.js";
import type { Callback, ProtocolOptions } from "./protocols.js";

type Unsubscribe = () => void | Promise<void>;
type PubSubTopic = string;
type ContentTopic = string;

export type ActiveSubscriptions = Map<PubSubTopic, ContentTopic[]>;

export interface IReceiverV1 {
  subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Unsubscribe | Promise<Unsubscribe>;
  getActiveSubscriptions: () => ActiveSubscriptions;
}

export interface IReceiverV2 extends IReceiverV1 {
  ping: () => Promise<void>;
  unsubscribeAll: () => Promise<void>;
}
