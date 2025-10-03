import { FilterCore } from "@waku/core";
import type {
  ContentTopic,
  FilterProtocolOptions,
  IDecodedMessage,
  IFilter,
  IRoutingInfo
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

  public async start(): Promise<void> {
    await this.protocol.start();
  }

  public async stop(): Promise<void> {
    await this.protocol.stop();
  }

  public unsubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      subscription.stop();
    }

    this.subscriptions.clear();
  }

  public async subscribe(
    contentTopics: ContentTopic[],
    routingInfo: IRoutingInfo,
    callback: (msg: IDecodedMessage) => void | Promise<void>
  ): Promise<boolean> {
    if (contentTopics.length === 0) {
      throw Error("Cannot subscribe with 0 contentTopics.");
    }

    const pubsubTopic = routingInfo.pubsubTopic;

    log.info(
      `Subscribing to contentTopics: ${contentTopics}, pubsubTopic: ${pubsubTopic}`
    );

    let subscription = this.subscriptions.get(pubsubTopic);
    if (!subscription) {
      subscription = new Subscription({
        pubsubTopic,
        protocol: this.protocol,
        config: this.config,
        peerManager: this.peerManager
      });
      subscription.start();
    }

    const result = await subscription.add(contentTopics, routingInfo, callback);
    this.subscriptions.set(pubsubTopic, subscription);

    log.info(
      `Subscription ${result ? "successful" : "failed"} for content topic: ${contentTopics}`
    );

    return result;
  }

  public async unsubscribe(
    contentTopics: ContentTopic[],
    routingInfo: IRoutingInfo
  ): Promise<boolean> {
    if (contentTopics.length === 0) {
      throw Error("Cannot unsubscribe with 0 contentTopics.");
    }
    const { pubsubTopic } = routingInfo;

    log.info(
      `Unsubscribing from contentTopics: ${contentTopics}, pubsubTopic: ${pubsubTopic}`
    );

    const subscription = this.subscriptions.get(pubsubTopic);
    if (!subscription) {
      log.warn("No subscriptions associated with the decoder.");
      return false;
    }

    const result = await subscription.remove(contentTopics);

    if (subscription.isEmpty()) {
      log.warn("Subscription has no decoders anymore, terminating it.");
      subscription.stop();
      this.subscriptions.delete(pubsubTopic);
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
}
