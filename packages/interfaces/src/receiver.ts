import type { IDecodedMessage, IDecoder } from "./message.js";
import type { ContentTopic, IAsyncIterator, PubsubTopic } from "./misc.js";

export type ActiveSubscriptions = Map<PubsubTopic, ContentTopic[]>;

export interface IReceiver {
  toSubscriptionIterator: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ) => Promise<IAsyncIterator<T>>;
}
