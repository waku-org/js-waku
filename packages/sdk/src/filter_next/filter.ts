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
    decoder: IDecoder<T>,
    callback: Callback<T>
  ): Promise<boolean> {
    log.info(
      `Subscribing to content topic: ${decoder.contentTopic}, pubsub topic: ${decoder.pubsubTopic}`
    );

    const supportedPubsubTopic = this.connectionManager.pubsubTopics.includes(
      decoder.pubsubTopic
    );

    if (!supportedPubsubTopic) {
      throw Error("Pubsub topic of the decoder is not supported.");
    }

    let subscription = this.subscriptions.get(decoder.pubsubTopic);
    if (!subscription) {
      subscription = new Subscription({
        pubsubTopic: decoder.pubsubTopic,
        libp2p: this.libp2p,
        protocol: this.protocol,
        config: this.config,
        peerManager: this.peerManager
      });
      subscription.start();
    }

    const result = await subscription.add(decoder, callback);
    this.subscriptions.set(decoder.pubsubTopic, subscription);

    log.info(
      `Subscription ${result ? "successful" : "failed"} for content topic: ${decoder.contentTopic}`
    );

    return result;
  }

  public async unsubscribe<T extends IDecodedMessage>(
    decoder: IDecoder<T>
  ): Promise<boolean> {
    log.info(
      `Unsubscribing from content topic: ${decoder.contentTopic}, pubsub topic: ${decoder.pubsubTopic}`
    );

    const supportedPubsubTopic = this.connectionManager.pubsubTopics.includes(
      decoder.pubsubTopic
    );
    if (!supportedPubsubTopic) {
      throw Error("Pubsub topic of the decoder is not supported.");
    }

    const subscription = this.subscriptions.get(decoder.pubsubTopic);
    if (!subscription) {
      log.warn("No subscriptions associated with the decoder.");
      return false;
    }

    const result = await subscription.remove(decoder);

    if (subscription.isEmpty()) {
      log.warn("Subscription has no decoders anymore, terminating it.");
      subscription.stop();
      this.subscriptions.delete(decoder.pubsubTopic);
    }

    log.info(
      `Unsubscribing ${result ? "successful" : "failed"} for content topic: ${decoder.contentTopic}`
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
}
