import { ContentFilter } from "./filter.js";
import type { IDecodedMessage, IDecoder } from "./message.js";
import type { Callback, ProtocolOptions } from "./protocols.js";

type PubSubTopic = string;
type ContentTopic = string;

export type SubscriptionReturn<FilterVersion extends "v1" | "v2"> = {
  unsubscribe: (contentFilters: ContentFilter[]) => Promise<void>;
  unsubscribeAll: () => Promise<void>;
} & (FilterVersion extends "v1" ? object : { ping: () => Promise<void> });

export type ActiveSubscriptions = Map<PubSubTopic, ContentTopic[]>;

export interface IReceiver<FilterVersion extends "v1" | "v2"> {
  subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) =>
    | SubscriptionReturn<FilterVersion>
    | Promise<SubscriptionReturn<FilterVersion>>;
  getActiveSubscriptions: () => ActiveSubscriptions;
}
