import type { Peer, PeerId } from "@libp2p/interface";
import { WakuMessage } from "@waku/proto";

import type { IDecodedMessage, IDecoder } from "./message.js";
import type { ContentTopic, PubsubTopic, ThisOrThat } from "./misc.js";
import type {
  Callback,
  CoreProtocolResult,
  IBaseProtocolCore,
  IBaseProtocolSDK,
  ProtocolError,
  ProtocolUseOptions,
  SDKProtocolResult
} from "./protocols.js";
import type { IReceiver } from "./receiver.js";

export type SubscriptionCallback<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
};

export type SubscribeOptions = {
  keepAlive?: number;
  pingsBeforePeerRenewed?: number;
  maxMissedMessagesThreshold?: number;
};

export type IFilterCore = IBaseProtocolCore & {
  subscribe(
    pubsubTopic: PubsubTopic,
    peer: Peer,
    contentTopics: ContentTopic[]
  ): Promise<CoreProtocolResult>;
};

export type IFilter = IReceiver & IFilterCore;

export interface ISubscriptionSDK {
  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    options?: SubscribeOptions
  ): Promise<SDKProtocolResult>;

  unsubscribe(contentTopics: ContentTopic[]): Promise<SDKProtocolResult>;

  ping(peerId?: PeerId): Promise<SDKProtocolResult>;

  unsubscribeAll(): Promise<SDKProtocolResult>;

  processIncomingMessage(message: WakuMessage): Promise<void>;
}

export type MessageHandler = (
  pubsubTopic: PubsubTopic,
  message: WakuMessage,
  peerIdStr?: string
) => void;

export interface IFilterSDK extends IReceiver, IBaseProtocolSDK {
  protocol: IFilterCore;

  setMessageHandler(handler: MessageHandler): void;

  subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    protocolUseOptions?: ProtocolUseOptions,
    subscribeOptions?: SubscribeOptions
  ): Promise<SubscribeResult>;

  processReliableMessage(pubsubTopic: PubsubTopic, message: WakuMessage): void;
}

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
