import type { IDecodedMessage, IDecoder } from "./message.js";
import type { ContentTopic, PubsubTopic, ThisOrThat } from "./misc.js";
import type {
  Callback,
  IBaseProtocolCore,
  IBaseProtocolSDK,
  ProtocolError,
  SDKProtocolResult,
  ShardingParams
} from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type ContentFilter = {
  contentTopic: string;
};

export type IFilter = IReceiver & IBaseProtocolCore;

export interface ISubscriptionSDK {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<SDKProtocolResult>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<SDKProtocolResult>;

  ping(): Promise<SDKProtocolResult>;

  unsubscribeAll(): Promise<SDKProtocolResult>;
}

export type IFilterSDK = IReceiver &
  IBaseProtocolSDK & { protocol: IBaseProtocolCore } & {
    createSubscription(
      pubsubTopicShardInfo?: ShardingParams | PubsubTopic
    ): Promise<CreateSubscriptionResult>;
  };

export type CreateSubscriptionResult = ThisOrThat<
  "subscription",
  ISubscriptionSDK,
  "error",
  ProtocolError
>;
