import type { PeerId } from "@libp2p/interface/peer-id";

import type { IDecodedMessage, IDecoder } from "./message";
import type { ContentTopic } from "./misc";
import type { Callback, IBaseProtocol } from "./protocols";
import type { IReceiver } from "./receiver";

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
      pubSubTopic?: string,
      peerId?: PeerId
    ): Promise<IFilterSubscription>;
  };
