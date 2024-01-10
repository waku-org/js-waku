import type { PeerId } from "@libp2p/interface/peer-id";

import type { IDecodedMessage, IDecoder, SingleShardInfo } from "./message.js";
import type { ContentTopic, PubsubTopic } from "./misc.js";
import type { Callback, IBaseProtocol } from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type ContentFilter = {
  contentTopic: string;
};

export interface IFilterSubscription {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<void>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<void>;

  ping(): Promise<void>;

  unsubscribeAll(): Promise<void>;
}

export type IFilter = IReceiver &
  IBaseProtocol & {
    createSubscription(
      pubsubTopicShardInfo?: SingleShardInfo | PubsubTopic,
      peerId?: PeerId
    ): Promise<IFilterSubscription>;
  };
