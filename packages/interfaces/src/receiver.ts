import type { IDecodedMessage, IDecoder } from "./message.js";
import type { IAsyncIterator, Unsubscribe } from "./misc.js";
import type { Callback } from "./protocols.js";

/**
 * @deprecated will be replaced in next version
 */
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
