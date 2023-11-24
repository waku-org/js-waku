import { EventEmitter } from "@libp2p/interface/events";
import type { PeerId } from "@libp2p/interface/peer-id";

import type { IDecodedMessage, IDecoder } from "./message.js";
import type { ContentTopic } from "./misc.js";
import type { IBaseProtocol } from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type ContentFilter = {
  contentTopic: string;
};

export interface SubscriptionEventMap {
  [key: string]: CustomEvent<IDecodedMessage>;
}

export interface IFilterSubscription
  extends EventEmitter<SubscriptionEventMap> {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): Promise<void>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<void>;

  ping(): Promise<void>;

  unsubscribeAll(): Promise<void>;
}

export type IFilter = IReceiver &
  IBaseProtocol & {
    createSubscription(
      decoders: IDecoder<IDecodedMessage>[],
      pubsubTopic?: string,
      peerId?: PeerId
    ): Promise<IFilterSubscription>;
  };
