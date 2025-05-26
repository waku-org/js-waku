import { ConnectionManager, FilterCore } from "@waku/core";
import type {
  Callback,
  NextFilterOptions as FilterOptions,
  IDecodedMessage,
  IDecoder,
  INextFilter as IFilter,
  Libp2p
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

import { Subscription } from "./subscription.js";
import { FilterConstructorParams } from "./types.js";

const log = new Logger("sdk:next-filter");

type PubsubTopic = string;

export class Filter implements IFilter {
  private readonly libp2p: Libp2p;
  private readonly protocol: FilterCore;
  private readonly peerManager: PeerManager;
  private readonly connectionManager: ConnectionManager;

  private readonly config: FilterOptions;
  private subscriptions = new Map<PubsubTopic, Subscription>();

  public constructor(params: FilterConstructorParams) {
    this.config = {
      numPeersToUse: 2,
      pingsBeforePeerRenewed: 3,
      keepAliveIntervalMs: 60_000,
      ...params.options
    };

    this.libp2p = params.libp2p;
    this.peerManager = params.peerManager;
    this.connectionManager = params.connectionManager;

    this.protocol = new FilterCore(
      this.onIncomingMessage.bind(this),
      params.connectionManager.pubsubTopics,
      params.libp2p
    );
  }

  public async subscribe<T extends IDecodedMessage>(
    decoder: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<boolean> {
    const decoders = Array.isArray(decoder) ? decoder : [decoder];

    if (decoders.length === 0) {
      throw Error("Cannot subscribe with 0 decoders.");
    }

    const pubsubTopics = decoders.map((v) => v.pubsubTopic);
    const contentTopics = decoders.map((v) => v.contentTopic);

    // doing this for simplicity, we can enable subscription for more than one PubsubTopic at once later when requested
    if (!this.isSamePubsubTopic(decoders)) {
      throw Error(
        `Cannot subscribe to more than one pubsub topic at the same time, got pubsubTopics:${pubsubTopics}`
      );
    }

    log.info(
      `Subscribing to content topic: ${contentTopics}, pubsub topic: ${pubsubTopics}`
    );

    const supportedPubsubTopic = this.connectionManager.pubsubTopics.includes(
      pubsubTopics[0]
    );

    if (!supportedPubsubTopic) {
      throw Error(
        `Pubsub topic ${pubsubTopics[0]} has not been configured on this instance.`
      );
    }

    let subscription = this.subscriptions.get(pubsubTopics[0]);
    if (!subscription) {
      subscription = new Subscription({
        pubsubTopic: pubsubTopics[0],
        libp2p: this.libp2p,
        protocol: this.protocol,
        config: this.config,
        peerManager: this.peerManager
      });
      subscription.start();
    }

    const result = await subscription.add(decoders, callback);
    this.subscriptions.set(pubsubTopics[0], subscription);

    log.info(
      `Subscription ${result ? "successful" : "failed"} for content topic: ${contentTopics}`
    );

    return result;
  }

  public async unsubscribe<T extends IDecodedMessage>(
    decoder: IDecoder<T> | IDecoder<T>[]
  ): Promise<boolean> {
    const decoders = Array.isArray(decoder) ? decoder : [decoder];

    if (decoders.length === 0) {
      throw Error("Cannot unsubscribe with 0 decoders.");
    }

    const pubsubTopics = decoders.map((v) => v.pubsubTopic);
    const contentTopics = decoders.map((v) => v.contentTopic);

    // doing this for simplicity, we can enable unsubscribing with more than one PubsubTopic at once later when requested
    if (!this.isSamePubsubTopic(decoders)) {
      throw Error(
        `Cannot unsubscribe with more than one pubsub topic at the same time, got pubsubTopics:${pubsubTopics}`
      );
    }

    log.info(
      `Unsubscribing from content topic: ${contentTopics}, pubsub topic: ${pubsubTopics}`
    );

    const supportedPubsubTopic = this.connectionManager.pubsubTopics.includes(
      pubsubTopics[0]
    );
    if (!supportedPubsubTopic) {
      throw Error("Pubsub topic of the decoder is not supported.");
    }

    const subscription = this.subscriptions.get(pubsubTopics[0]);
    if (!subscription) {
      log.warn("No subscriptions associated with the decoder.");
      return false;
    }

    const result = await subscription.remove(decoders);

    if (subscription.isEmpty()) {
      log.warn("Subscription has no decoders anymore, terminating it.");
      subscription.stop();
      this.subscriptions.delete(pubsubTopics[0]);
    }

    log.info(
      `Unsubscribing ${result ? "successful" : "failed"} for content topic: ${contentTopics}`
    );

    return result;
  }

  private async onIncomingMessage(
    pubsubTopic: string,
    message: WakuMessage,
    peerId: string
  ): Promise<void> {
    log.info(
      `Received message for pubsubTopic:${pubsubTopic}, contentTopic:${message.contentTopic}, peerId:${peerId.toString()}`
    );

    const subscription = this.subscriptions.get(pubsubTopic);

    if (!subscription) {
      log.error(`No subscription locally registered for topic ${pubsubTopic}`);
      return;
    }

    subscription.invoke(message, peerId);
  }

  private isSamePubsubTopic<T extends IDecodedMessage>(
    decoders: IDecoder<T>[]
  ): boolean {
    const topics = new Set<string>();

    for (const decoder of decoders) {
      topics.add(decoder.pubsubTopic);
    }

    return topics.size === 1;
  }
}
