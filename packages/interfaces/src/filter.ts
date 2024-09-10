import type { Peer, PeerId } from "@libp2p/interface";
import { WakuMessage } from "@waku/proto";

import type { IDecodedMessage, IDecoder } from "./message.js";
import type {
  ContentTopic,
  PeerIdStr,
  PubsubTopic,
  ThisOrThat
} from "./misc.js";
import type {
  Callback,
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

  renewAndSubscribePeer(peerId: PeerId): Promise<Peer | undefined>;
}

export type IFilterSDK = IReceiver &
  IBaseProtocolSDK & { protocol: IBaseProtocolCore } & {
    subscribe<T extends IDecodedMessage>(
      decoders: IDecoder<T> | IDecoder<T>[],
      callback: Callback<T>,
      protocolUseOptions?: ProtocolUseOptions,
      subscribeOptions?: SubscribeOptions
    ): Promise<SubscribeResult>;

    activeSubscriptions: Map<PubsubTopic, ISubscriptionSDK>;

    setIncomingMessageHandler(
      handler: (
        pubsubTopic: ContentTopic,
        message: WakuMessage,
        peerIdStr: PeerIdStr
      ) => void
    ): void;
    handleIncomingMessage: (
      pubsubTopic: ContentTopic,
      message: WakuMessage,
      peerIdStr: PeerIdStr
    ) => void;
    readonly defaultHandleIncomingMessage: (
      pubsubTopic: ContentTopic,
      message: WakuMessage,
      peerIdStr: PeerIdStr
    ) => void;
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
