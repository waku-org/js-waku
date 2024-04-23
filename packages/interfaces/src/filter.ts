import type { PeerId } from "@libp2p/interface";

import type { IDecodedMessage, IDecoder, SingleShardInfo } from "./message.js";
import type { ContentTopic, PubsubTopic } from "./misc.js";
import type {
  Callback,
  IBaseProtocolCore,
  IBaseProtocolSDK,
  SDKProtocolResult
} from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type ContentFilter = {
  contentTopic: string;
};

export type IFilter = IReceiver & IBaseProtocolCore;

export interface IFilterSubscriptionSDK {
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
      pubsubTopicShardInfo?: SingleShardInfo | PubsubTopic,
      peerId?: PeerId
    ): Promise<IFilterSubscriptionSDK>;
  };
