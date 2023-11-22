import type { PeerId } from "@libp2p/interface/peer-id";

import type { IDecodedMessage, IDecoder } from "./message.js";
import type { ContentTopic } from "./misc.js";
import type { Callback, IBaseProtocol } from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export enum EFilterErrorKind {
  UNKNOWN = 0,
  PEER_DIAL_FAILURE = 200,
  BAD_RESPONSE = 300,
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  SERVICE_UNAVAILABLE = 503
}

export enum EFilterSuccessKind {
  OK = 200
}

export interface IFilterResponse {
  requestId: string;
  statusCode: EFilterErrorKind | EFilterSuccessKind;
  message?: string;
}

export type ContentFilter = {
  contentTopic: string;
};

export interface IFilterSubscription {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<IFilterResponse>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<IFilterResponse>;

  ping(): Promise<IFilterResponse>;

  unsubscribeAll(): Promise<IFilterResponse>;
}

export type IFilter = IReceiver &
  IBaseProtocol & {
    createSubscription(
      pubsubTopic?: string,
      peerId?: PeerId
    ): Promise<IFilterSubscription>;
  };
