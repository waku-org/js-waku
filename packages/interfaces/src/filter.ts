import type { PeerId } from "@libp2p/interface";

import type { IDecodedMessage, IDecoder } from "./message.js";
import type { ContentTopic, ThisOrThat } from "./misc.js";
import type {
  Callback,
  IBaseProtocolCore,
  IBaseProtocolSDK,
  ProtocolError,
  ProtocolUseOptions,
  SDKProtocolResult
} from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type SubscribeOptions = {
  keepAlive?: number;
  pingsBeforePeerRenewed?: number;
  maxMissedMessagesThreshold?: number;
};

export type SubscriptionCallback<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
};

export type IFilter = IReceiver & IBaseProtocolCore;

export interface ISubscriptionSDK {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    options?: SubscribeOptions
  ): Promise<SDKProtocolResult>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<SDKProtocolResult>;

  ping(peerId?: PeerId): Promise<SDKProtocolResult>;

  unsubscribeAll(): Promise<SDKProtocolResult>;
}

export type IFilterSDK = IReceiver &
  IBaseProtocolSDK & { protocol: IBaseProtocolCore } & {
    subscribe<T extends IDecodedMessage>(
      decoders: IDecoder<T> | IDecoder<T>[],
      callback: Callback<T>,
      protocolUseOptions?: ProtocolUseOptions,
      subscribeOptions?: SubscribeOptions
    ): Promise<SubscribeResult>;
  };

export type SubscribeResult = SubscriptionSuccess | SubscriptionError;

type SubscriptionSuccess = {
  subscription: ISubscriptionSDK;
  error: null;
  results: SDKProtocolResult;
};

type SubscriptionError = {
  subscription: null;
  error: ProtocolError;
  results: null;
};

export type CreateSubscriptionResult = ThisOrThat<
  "subscription",
  ISubscriptionSDK,
  "error",
  ProtocolError
>;
