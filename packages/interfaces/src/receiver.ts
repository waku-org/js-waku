import type { IDecodedMessage, IDecoder } from "./message.js";
import type { Callback, ProtocolOptions } from "./protocols.js";

type Unsubscribe<T> = () => T;
type PubSubTopic = string;
type ContentTopic = string;

export type ActiveSubscriptions = Map<PubSubTopic, ContentTopic[]>;

export interface IReceiver {
  subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Unsubscribe<void> | Promise<Unsubscribe<Promise<void>>>;
  getActiveSubscriptions: () => ActiveSubscriptions;
}
