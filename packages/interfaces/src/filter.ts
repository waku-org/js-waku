import type { PeerId } from "@libp2p/interface";

import type { IDecodedMessage, IDecoder, SingleShardInfo } from "./message.js";
import type { ContentTopic, PubsubTopic } from "./misc.js";
import type {
  Callback,
  IBaseProtocolCore,
  IBaseProtocolSDK
} from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type SubscribeOptions = {
  keepAlive?: number;
  peerId?: PeerId;
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
      pubsubTopicShardInfo?: SingleShardInfo | PubsubTopic,
      options?: SubscribeOptions
    ): Promise<IFilterSubscription>;
  };
