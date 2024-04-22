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

import type { Subscription } from "./subscription";
import { SubscriptionManager } from "./subscription_manager";

const log = new Logger("sdk:filter");

class FilterSDK extends BaseProtocolSDK implements IFilterSDK {
  public readonly protocol: FilterCore;
  public readonly subscriptionManager: SubscriptionManager;

  private async handleIncomingMessage(
    pubsubTopic: PubsubTopic,
    wakuMessage: WakuMessage
  ): Promise<void> {
    const subscription = this.subscriptionManager.getSubscription(pubsubTopic);
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
    this.subscriptionManager = SubscriptionManager.createInstance(
      this.protocol
    );
  }

  /**
   * Creates a new subscription to the given pubsub topic.
   * The subscription is made to multiple peers for decentralization.
   * @param pubsubTopicShardInfo The pubsub topic to subscribe to.
   * @returns The subscription object.
   */
  async createSubscription(
    pubsubTopicShardInfo: SingleShardInfo | PubsubTopic = DefaultPubsubTopic
  ): Promise<Subscription> {
    const pubsubTopic =
      typeof pubsubTopicShardInfo == "string"
        ? pubsubTopicShardInfo
        : singleShardInfoToPubsubTopic(pubsubTopicShardInfo);

    ensurePubsubTopicIsConfigured(pubsubTopic, this.protocol.pubsubTopics);

    return this.subscriptionManager.getOrCreate(pubsubTopic);
  }

  //TODO: remove this dependency on IReceiver
  /**
   * This method is used to satisfy the `IReceiver` interface.
   *
   * @hidden
   *
   * @param decoders The decoders to use for the subscription.
   * @param callback The callback function to use for the subscription.
   * @param opts Optional protocol options for the subscription.
   *
   * @returns A Promise that resolves to a function that unsubscribes from the subscription.
   *
   * @remarks
   * This method should not be used directly.
   * Instead, use `createSubscription` to create a new subscription.
   */
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
