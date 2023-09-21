import type { IDecodedMessage, IDecoder } from "./message";
import type {
  ContentTopic,
  IAsyncIterator,
  PubSubTopic,
  Unsubscribe
} from "./misc";
import type { Callback } from "./protocols";

export type ActiveSubscriptions = Map<PubSubTopic, ContentTopic[]>;

export interface IReceiver {
  toSubscriptionIterator: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ) => Promise<IAsyncIterator<T>>;
  subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ) => Unsubscribe | Promise<Unsubscribe>;
}
