import { ConnectionManager, FilterCore } from "@waku/core";
import type {
  Callback,
  FilterProtocolOptions,
  IDecodedMessage,
  IDecoder,
  IFilter,
  Libp2p
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

import { NewPeerManager } from "../peer_manager/index.js";

import { Subscription } from "./subscription.js";
import { FilterConstructorParams } from "./types.js";

const log = new Logger("sdk:next-filter");

type PubsubTopic = string;

export class Filter implements IFilter {
  private readonly libp2p: Libp2p;
  private readonly protocol: FilterCore;
  private readonly peerManager: NewPeerManager;
  private readonly connectionManager: ConnectionManager;

  private readonly config: FilterProtocolOptions;
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

  public get multicodec(): string {
    return this.protocol.multicodec;
  }

  /**
   * Unsubscribes from all active subscriptions across all pubsub topics.
   *
   * @example
   * // Clean up all subscriptions when React component unmounts
   * useEffect(() => {
   *   return () => filter.unsubscribeAll();
   * }, [filter]);
   *
   * @example
   * // Reset subscriptions and start over
   * filter.unsubscribeAll();
   * await filter.subscribe(newDecoder, newCallback);
   */
  public unsubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.stop();
    }

    this.subscriptions.clear();
  }

  /**
   * Subscribes to messages with specified decoders and executes callback when a message is received.
   * In case no peers available initially - will delay subscription till connects to any peer.
   *
   * @param decoders - Single decoder or array of decoders to subscribe to. All decoders must share the same pubsubTopic.
   * @param callback - Function called when a message matching the decoder's contentTopic is received.
   * @returns Promise that resolves to true if subscription was successful, false otherwise.
   *
   * @example
   * // Subscribe to a single content topic
   * await filter.subscribe(decoder, (msg) => console.log(msg));
   *
   * @example
   * // Subscribe to multiple content topics with the same pubsub topic
   * await filter.subscribe([decoder1, decoder2], (msg) => console.log(msg));
   *
   * @example
   * // Handle subscription failure
   * const success = await filter.subscribe(decoder, handleMessage);
   * if (!success) {
   *   console.error("Failed to subscribe");
   * }
   */
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

  /**
   * Unsubscribes from messages with specified decoders.
   *
   * @param decoders - Single decoder or array of decoders to unsubscribe from. All decoders must share the same pubsubTopic.
   * @returns Promise that resolves to true if unsubscription was successful, false otherwise.
   *
   * @example
   * // Unsubscribe from a single decoder
   * await filter.unsubscribe(decoder);
   *
   * @example
   * // Unsubscribe from multiple decoders at once
   * await filter.unsubscribe([decoder1, decoder2]);
   *
   * @example
   * // Handle unsubscription failure
   * const success = await filter.unsubscribe(decoder);
   * if (!success) {
   *   console.error("Failed to unsubscribe");
   * }
   */
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
      throw Error(
        `Pubsub topic ${pubsubTopics[0]} has not been configured on this instance.`
      );
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
