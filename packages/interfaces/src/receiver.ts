import type { IDecoder } from "./message.js";
import type {
  ContentTopic,
  IAsyncIterator,
  PubsubTopic,
  Unsubscribe
} from "./misc.js";
import type { Callback } from "./protocols.js";

export type ActiveSubscriptions = Map<PubsubTopic, ContentTopic[]>;

export interface IReceiver {
  toSubscriptionIterator: (
    decoders: IDecoder | IDecoder[]
  ) => Promise<IAsyncIterator>;
  subscribeWithUnsubscribe: SubscribeWithUnsubscribe;
}

type SubscribeWithUnsubscribe = (
  decoders: IDecoder | IDecoder[],
  callback: Callback
) => Unsubscribe | Promise<Unsubscribe>;
