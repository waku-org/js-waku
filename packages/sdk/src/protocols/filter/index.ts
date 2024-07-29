import { ConnectionManager, FilterCore } from "@waku/core";
import {
  type Callback,
  type CreateSubscriptionResult,
  type IAsyncIterator,
  type IDecodedMessage,
  type IDecoder,
  type IFilterSDK,
  type Libp2p,
  type ProtocolCreateOptions,
  ProtocolError,
  type ProtocolUseOptions,
  type PubsubTopic,
  type ShardingParams,
  type SubscribeOptions,
  type Unsubscribe
} from "@waku/interfaces";
import {
  ensurePubsubTopicIsConfigured,
  groupByContentTopic,
  Logger,
  shardInfoToPubsubTopics,
  toAsyncIterator
} from "@waku/utils";

import { BaseProtocolSDK } from "../base_protocol.js";

import {
  DEFAULT_SUBSCRIBE_OPTIONS,
  SubscriptionManager
} from "./subscription_manager.js";

const log = new Logger("sdk:filter");

class FilterSDK extends BaseProtocolSDK implements IFilterSDK {
  public readonly protocol: FilterCore;

  private activeSubscriptions = new Map<string, SubscriptionManager>();

  public constructor(
    connectionManager: ConnectionManager,
    libp2p: Libp2p,
    options?: ProtocolCreateOptions
  ) {
    super(
      new FilterCore(
        async (pubsubTopic, wakuMessage, peerIdStr) => {
          const subscription = this.getActiveSubscription(pubsubTopic);
          if (!subscription) {
            log.error(
              `No subscription locally registered for topic ${pubsubTopic}`
            );
            return;
          }

          await subscription.processIncomingMessage(wakuMessage, peerIdStr);
        },
        libp2p,
        options
      ),
      connectionManager,
      { numPeersToUse: options?.numPeersToUse }
    );

    this.protocol = this.core as FilterCore;

    this.activeSubscriptions = new Map();
  }

  //TODO: move to SubscriptionManager
  private getActiveSubscription(
    pubsubTopic: PubsubTopic
  ): SubscriptionManager | undefined {
    return this.activeSubscriptions.get(pubsubTopic);
  }

  private setActiveSubscription(
    pubsubTopic: PubsubTopic,
    subscription: SubscriptionManager
  ): SubscriptionManager {
    this.activeSubscriptions.set(pubsubTopic, subscription);
    return subscription;
  }

  /**
   * Creates a new subscription to the given pubsub topic.
   * The subscription is made to multiple peers for decentralization.
   * @param pubsubTopicShardInfo The pubsub topic to subscribe to.
   * @returns The subscription object.
   */
  public async createSubscription(
    pubsubTopicShardInfo: ShardingParams | PubsubTopic,
    options?: ProtocolUseOptions
  ): Promise<CreateSubscriptionResult> {
    options = {
      autoRetry: true,
      ...options
    } as ProtocolUseOptions;

    const pubsubTopic =
      typeof pubsubTopicShardInfo == "string"
        ? pubsubTopicShardInfo
        : shardInfoToPubsubTopics(pubsubTopicShardInfo)?.[0];

    ensurePubsubTopicIsConfigured(pubsubTopic, this.protocol.pubsubTopics);

    const hasPeers = await this.hasPeers(options);
    if (!hasPeers) {
      return {
        error: ProtocolError.NO_PEER_AVAILABLE,
        subscription: null
      };
    }

    log.info(
      `Creating filter subscription with ${this.connectedPeers.length} peers: `,
      this.connectedPeers.map((peer) => peer.id.toString())
    );

    const subscription =
      this.getActiveSubscription(pubsubTopic) ??
      this.setActiveSubscription(
        pubsubTopic,
        new SubscriptionManager(
          pubsubTopic,
          this.protocol,
          () => this.connectedPeers,
          this.renewPeer.bind(this)
        )
      );

    return {
      error: null,
      subscription
    };
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
  public async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    options: SubscribeOptions = DEFAULT_SUBSCRIBE_OPTIONS
  ): Promise<Unsubscribe> {
    const uniquePubsubTopics = this.getUniquePubsubTopics<T>(decoders);

    if (uniquePubsubTopics.length === 0) {
      throw Error(
        "Failed to subscribe: no pubsubTopic found on decoders provided."
      );
    }

    if (uniquePubsubTopics.length > 1) {
      throw Error(
        "Failed to subscribe: all decoders should have the same pubsub topic. Use createSubscription to be more agile."
      );
    }

    const { subscription, error } = await this.createSubscription(
      uniquePubsubTopics[0]
    );

    if (error) {
      throw Error(`Failed to create subscription: ${error}`);
    }

    await subscription.subscribe(decoders, callback, options);

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

  private getUniquePubsubTopics<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): string[] {
    if (!Array.isArray(decoders)) {
      return [decoders.pubsubTopic];
    }

    if (decoders.length === 0) {
      return [];
    }

    const pubsubTopics = new Set(decoders.map((d) => d.pubsubTopic));

    return [...pubsubTopics];
  }
}

export function wakuFilter(
  connectionManager: ConnectionManager,
  init?: ProtocolCreateOptions
): (libp2p: Libp2p) => IFilterSDK {
  return (libp2p: Libp2p) => new FilterSDK(connectionManager, libp2p, init);
}
