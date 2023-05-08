import type { IDecodedMessage, IDecoder } from "./message.js";
import type {
  ContentTopic,
  IAsyncIterator,
  PubSubTopic,
  Unsubscribe,
} from "./misc.js";
import type { Callback, ProtocolOptions } from "./protocols.js";

export type ActiveSubscriptions = Map<PubSubTopic, ContentTopic[]>;

export interface IReceiver {
  toAsyncIterator: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    opts?: ProtocolOptions
  ) => Promise<IAsyncIterator<T>>;
  subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Unsubscribe | Promise<Unsubscribe>;
  getActiveSubscriptions: () => ActiveSubscriptions;
}
