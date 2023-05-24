import type { IDecodedMessage, IDecoder } from "./message.js";
import type { IAsyncIterator, PubSubTopic, Unsubscribe } from "./misc.js";
import type { Callback, ProtocolOptions } from "./protocols.js";

type ContentTopic = string;

export type ActiveSubscriptions = Map<PubSubTopic, ContentTopic[]>;

export interface IReceiver {
  toSubscriptionIterator: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    opts?: ProtocolOptions
  ) => Promise<IAsyncIterator<T>>;
  subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Unsubscribe | Promise<Unsubscribe>;
}
