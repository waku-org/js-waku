import type { IDecodedMessage, IDecoder } from "./message.js";
import type {
  ContentTopic,
  IAsyncIterator,
  PubsubTopic,
  Unsubscribe
} from "./misc.js";
import type { Callback } from "./protocols.js";

export type ActiveSubscriptions = Map<PubsubTopic, ContentTopic[]>;

export interface IReceiver {
  toSubscriptionIterator: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ) => Promise<IAsyncIterator<T>>;
  subscribeWithUnsubscribe: SubscribeWithUnsubscribe;
}

type SubscribeWithUnsubscribe = <T extends IDecodedMessage>(
  decoders: IDecoder<T> | IDecoder<T>[],
  callback: Callback<T>
) => Unsubscribe | Promise<Unsubscribe>;
