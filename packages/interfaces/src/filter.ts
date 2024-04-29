import type { IDecodedMessage, IDecoder } from "./message.js";
import type { ContentTopic, PubsubTopic } from "./misc.js";
import type {
  Callback,
  IBaseProtocolCore,
  IBaseProtocolSDK,
  ShardingParams
} from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type SubscribeOptions = {
  keepAlive?: number;
};

export interface IFilterSubscription {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    options?: SubscribeOptions
  ): Promise<void>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<void>;

  ping(): Promise<void>;

  unsubscribeAll(): Promise<void>;
}

export type IFilterSDK = IReceiver &
  IBaseProtocolSDK & { protocol: IBaseProtocolCore } & {
    createSubscription(
      pubsubTopicShardInfo?: ShardingParams | PubsubTopic,
      options?: SubscribeOptions
    ): Promise<IFilterSubscription>;
  };
