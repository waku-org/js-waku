import { FilterCore } from "@waku/core";
import {
  type Callback,
  DefaultPubsubTopic,
  type IAsyncIterator,
  type IDecodedMessage,
  type IDecoder,
  type IFilterSDK,
  type Libp2p,
  type ProtocolCreateOptions,
  type PubsubTopic,
  type SingleShardInfo,
  type Unsubscribe
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import {
  ensurePubsubTopicIsConfigured,
  groupByContentTopic,
  Logger,
  singleShardInfoToPubsubTopic,
  toAsyncIterator
} from "@waku/utils";

import { BaseProtocolSDK } from "../base_protocol";

import { Subscription } from "./subscription";

const log = new Logger("sdk:filter");

class FilterSDK extends BaseProtocolSDK implements IFilterSDK {
  public readonly protocol: FilterCore;
  private subscriptions: Map<string, Subscription>;

  private async handleIncomingMessage(
    pubsubTopic: PubsubTopic,
    wakuMessage: WakuMessage
  ): Promise<void> {
    const subscription = this.getSubscription(pubsubTopic);
    if (!subscription) {
      log.error(`No subscription locally registered for topic ${pubsubTopic}`);
      return;
    }

    await subscription.processIncomingMessage(wakuMessage);
  }

  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super({ numPeersToUse: options?.numPeersToUse });
    this.protocol = new FilterCore(
      this.handleIncomingMessage.bind(this),
      libp2p,
      options
    );
    this.subscriptions = new Map();
  }

  private getSubscription(pubsubTopic: PubsubTopic): Subscription | undefined {
    return this.subscriptions.get(pubsubTopic);
  }

  private setSubscription(
    pubsubTopic: PubsubTopic,
    subscription: Subscription
  ): Subscription {
    this.subscriptions.set(pubsubTopic, subscription);
    return subscription;
  }

  private async getOrCreateSubscription(
    pubsubTopic: PubsubTopic
  ): Promise<Subscription> {
    const subscription = this.getSubscription(pubsubTopic);
    if (subscription) {
      return subscription;
    }

    log.info("Creating filter subscription.");

    const peers = await this.protocol.getPeers();
    if (peers.length === 0) {
      throw new Error("No peer found to initiate subscription.");
    }
    log.info(
      `Created filter subscription with ${peers.length} peers: `,
      peers.map((peer) => peer.id.toString())
    );

    const newSubscription = new Subscription(pubsubTopic, peers, this.protocol);
    return this.setSubscription(pubsubTopic, newSubscription);
  }

  async createSubscription(
    pubsubTopicShardInfo: SingleShardInfo | PubsubTopic = DefaultPubsubTopic
  ): Promise<Subscription> {
    const pubsubTopic =
      typeof pubsubTopicShardInfo == "string"
        ? pubsubTopicShardInfo
        : singleShardInfoToPubsubTopic(pubsubTopicShardInfo);

    ensurePubsubTopicIsConfigured(pubsubTopic, this.protocol.pubsubTopics);

    return this.getOrCreateSubscription(pubsubTopic);
  }

  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<Unsubscribe> {
    const subscription = await this.createSubscription();

    await subscription.subscribe(decoders, callback);

    const contentTopics = Array.from(
      groupByContentTopic(
        Array.isArray(decoders) ? decoders : [decoders]
      ).keys()
    );

    return async () => {
      await subscription.unsubscribe(contentTopics);
    };
  }

  public toSubscriptionIterator<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): Promise<IAsyncIterator<T>> {
    return toAsyncIterator(this, decoders);
  }
}

export function wakuFilter(
  init: ProtocolCreateOptions
): (libp2p: Libp2p) => IFilterSDK {
  return (libp2p: Libp2p) => new FilterSDK(libp2p, init);
}
