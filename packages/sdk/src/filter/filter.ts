import { FilterCore } from "@waku/core";
import type {
  Callback,
  FilterProtocolOptions,
  IDecodedMessage,
  IDecoder,
  IFilter
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

import { Subscription } from "./subscription.js";
import { FilterConstructorParams } from "./types.js";

const log = new Logger("sdk:filter");

type PubsubTopic = string;

export class Filter implements IFilter {
  private readonly protocol: FilterCore;
  private readonly peerManager: PeerManager;

  private readonly config: FilterProtocolOptions;
  private subscriptions = new Map<PubsubTopic, Subscription>();

  public constructor(params: FilterConstructorParams) {
    this.config = {
      numPeersToUse: 2,
      pingsBeforePeerRenewed: 3,
      keepAliveIntervalMs: 60_000,
      ...params.options
    };

    this.peerManager = params.peerManager;

    this.protocol = new FilterCore(
      this.onIncomingMessage.bind(this),
      params.libp2p
    );
  }

  public get multicodec(): string {
    return this.protocol.multicodec;
  }

  public async stop(): Promise<void> {
    this.unsubscribeAll();
    await this.protocol.stop();
  }

  public unsubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.stop();
    }

    this.subscriptions.clear();
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
    const singlePubsubTopic = pubsubTopics[0];

    const contentTopics = decoders.map((v) => v.contentTopic);

    log.info(
      `Subscribing to contentTopics: ${contentTopics}, pubsubTopic: ${singlePubsubTopic}`
    );

    this.throwIfTopicNotSame(pubsubTopics);

    let subscription = this.subscriptions.get(singlePubsubTopic);
    if (!subscription) {
      subscription = new Subscription({
        pubsubTopic: singlePubsubTopic,
        protocol: this.protocol,
        config: this.config,
        peerManager: this.peerManager
      });
      subscription.start();
    }

    const result = await subscription.add(decoders, callback);
    this.subscriptions.set(singlePubsubTopic, subscription);

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
    const singlePubsubTopic = pubsubTopics[0];

    const contentTopics = decoders.map((v) => v.contentTopic);

    log.info(
      `Unsubscribing from contentTopics: ${contentTopics}, pubsubTopic: ${singlePubsubTopic}`
    );

    this.throwIfTopicNotSame(pubsubTopics);

    const subscription = this.subscriptions.get(singlePubsubTopic);
    if (!subscription) {
      log.warn("No subscriptions associated with the decoder.");
      return false;
    }

    const result = await subscription.remove(decoders);

    if (subscription.isEmpty()) {
      log.warn("Subscription has no decoders anymore, terminating it.");
      subscription.stop();
      this.subscriptions.delete(singlePubsubTopic);
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

  // Limiting to one pubsubTopic for simplicity reasons, we can enable subscription for more than one PubsubTopic at once later when requested
  private throwIfTopicNotSame(pubsubTopics: string[]): void {
    const first = pubsubTopics[0];
    const isSameTopic = pubsubTopics.every((t) => t === first);

    if (!isSameTopic) {
      throw Error(
        `Cannot subscribe to more than one pubsub topic at the same time, got pubsubTopics:${pubsubTopics}`
      );
    }
  }
}
