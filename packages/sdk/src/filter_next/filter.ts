import { ConnectionManager, FilterCore } from "@waku/core";
import type {
  Callback,
  IDecodedMessage,
  IDecoder,
  Libp2p
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

import { PubsubSubscription } from "./pubsub_subscription.js";
import {
  FilterConstructorParams,
  FilterOptions,
  IFilter,
  PubsubTopic
} from "./types.js";

const log = new Logger("sdk:next-filter");

export class Filter implements IFilter {
  private readonly libp2p: Libp2p;
  private readonly protocol: FilterCore;
  private readonly peerManager: PeerManager;
  private readonly connectionManager: ConnectionManager;

  private readonly config: FilterOptions;
  private subscriptions = new Map<PubsubTopic, PubsubSubscription>();

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

  public subscribe<T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ): void {
    const supportedPubsubTopic = this.connectionManager.pubsubTopics.includes(
      decoder.pubsubTopic
    );
    if (!supportedPubsubTopic) {
      throw Error("Pubsub topic of the decoder is not supported.");
    }

    let subscription = this.subscriptions.get(decoder.pubsubTopic);
    if (!subscription) {
      subscription = new PubsubSubscription({
        pubsubTopic: decoder.pubsubTopic,
        libp2p: this.libp2p,
        protocol: this.protocol,
        config: this.config,
        peerManager: this.peerManager
      });
      subscription.start();
    }

    subscription.add(decoder, callback);
    this.subscriptions.set(decoder.pubsubTopic, subscription);

    return;
  }

  public unsubscribe<T extends IDecodedMessage>(decoder: IDecoder<T>): void {
    const supportedPubsubTopic = this.connectionManager.pubsubTopics.includes(
      decoder.pubsubTopic
    );
    if (!supportedPubsubTopic) {
      throw Error("Pubsub topic of the decoder is not supported.");
    }

    const subscription = this.subscriptions.get(decoder.pubsubTopic);
    if (!subscription) {
      log.warn("No subscriptions associated with the decoder.");
      return;
    }

    subscription.remove(decoder);

    if (subscription.isEmpty()) {
      log.warn("Subscription has no decoders anymore, terminating it.");
      subscription.stop();
      this.subscriptions.delete(decoder.pubsubTopic);
    }
  }

  private async onIncomingMessage(
    pubsubTopic: string,
    message: WakuMessage,
    peerId: string
  ): Promise<void> {
    const subscription = this.subscriptions.get(pubsubTopic);

    if (!subscription) {
      log.error(`No subscription locally registered for topic ${pubsubTopic}`);
      return;
    }

    subscription.invoke(message, peerId);
  }
}
