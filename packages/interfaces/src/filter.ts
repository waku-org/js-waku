import { PeerId } from "@libp2p/interface-peer-id";

import { IDecodedMessage, IDecoder } from "./message.js";
import { ContentTopic } from "./misc.js";
import type { Callback, PointToPointProtocol } from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type ContentFilter = {
  contentTopic: string;
};

export type IFilter = IReceiver & PointToPointProtocol;

export type PeerIdStr = string;
export type PeerSubscription<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
  pubSubTopic: string;
};

export type SubscriptionsLog = Map<PeerIdStr, unknown[]>;

export interface ErrorResult {
  error: boolean;
  errorCode?: number;
  errorString?: string;
}

export interface IFilterV2Subscription {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<ErrorResult>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<ErrorResult>;

  ping(): Promise<ErrorResult>;

  unsubscribeAll(): Promise<ErrorResult>;
}

export type IFilterV2 = PointToPointProtocol & {
  createSubscription(
    pubSubTopic?: string,
    peerId?: PeerId
  ): Promise<IFilterV2Subscription>;
};
