import { ConnectionManager, FilterCore } from "@waku/core";
import {
  type Callback,
  type CreateSubscriptionResult,
  type IAsyncIterator,
  type IDecodedMessage,
  type IDecoder,
  type IFilterSDK,
  type Libp2p,
  NetworkConfig,
  PeerIdStr,
  type ProtocolCreateOptions,
  ProtocolError,
  type ProtocolUseOptions,
  type PubsubTopic,
  type SubscribeOptions,
  SubscribeResult,
  type Unsubscribe
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import {
  ensurePubsubTopicIsConfigured,
  groupByContentTopic,
  Logger,
  shardInfoToPubsubTopics,
  toAsyncIterator
} from "@waku/utils";

import { BaseProtocolSDK } from "../base_protocol";
import { MessageReliabilityMonitor } from "../message_reliability_monitor";

import { SubscriptionManager } from "./subscription_manager";

const log = new Logger("sdk:filter");

class FilterSDK extends BaseProtocolSDK implements IFilterSDK {
  public readonly protocol: FilterCore;
  private readonly _connectionManager: ConnectionManager;

  public activeSubscriptions = new Map<PubsubTopic, SubscriptionManager>();

  public readonly defaultHandleIncomingMessage = (
    pubsubTopic: PubsubTopic,
    message: WakuMessage,
    peerIdStr: PeerIdStr
  ): void => {
    log.info(`Received message from ${peerIdStr} on topic ${pubsubTopic}`);
    const subscription = this.getActiveSubscription(pubsubTopic);
    if (!subscription) {
      log.error(`No subscription locally registered for topic ${pubsubTopic}`);
      return;
    }

    void subscription.processIncomingMessage(message);
  };

  public handleIncomingMessage = this.defaultHandleIncomingMessage;

  public constructor(
    connectionManager: ConnectionManager,
    libp2p: Libp2p,
    options?: ProtocolCreateOptions
  ) {
    super(
      new FilterCore(connectionManager.configuredPubsubTopics, libp2p),
      connectionManager,
      { numPeersToUse: options?.numPeersToUse }
    );

    this.protocol = this.core as FilterCore;
    this.protocol.incomingMessageHandler = this.handleIncomingMessage;
    this._connectionManager = connectionManager;
  }

  public setIncomingMessageHandler(
    handler: (
      pubsubTopic: PubsubTopic,
      message: WakuMessage,
      peerIdStr: string
    ) => void
  ): void {
    this.handleIncomingMessage = handler;
    this.protocol.incomingMessageHandler = handler;
  }

  /**
   * Opens a subscription with the Filter protocol using the provided decoders and callback.
   * This method combines the functionality of creating a subscription and subscribing to it.
   *
   * @param {IDecoder<T> | IDecoder<T>[]} decoders - A single decoder or an array of decoders to use for decoding messages.
   * @param {Callback<T>} callback - The callback function to be invoked with decoded messages.
   * @param {ProtocolUseOptions} [protocolUseOptions] - Optional settings for using the protocol.
   * @param {SubscribeOptions} [subscribeOptions] - Options for the subscription.
   *
   * @returns {Promise<SubscribeResult>} A promise that resolves to an object containing:
   *   - subscription: The created subscription object if successful, or null if failed.
   *   - error: A ProtocolError if the subscription creation failed, or null if successful.
   *   - results: An object containing arrays of failures and successes from the subscription process.
   *     Only present if the subscription was created successfully.
   *
   * @throws {Error} If there's an unexpected error during the subscription process.
   *
   * @remarks
   * This method attempts to create a subscription using the pubsub topic derived from the provided decoders,
   * then tries to subscribe using the created subscription. The return value should be interpreted as follows:
   * - If `subscription` is null and `error` is non-null, a critical error occurred and the subscription failed completely.
   * - If `subscription` is non-null and `error` is null, the subscription was created successfully.
   *   In this case, check the `results` field for detailed information about successes and failures during the subscription process.
   * - Even if the subscription was created successfully, there might be some failures in the results.
   *
   * @example
   * ```typescript
   * const {subscription, error, results} = await waku.filter.subscribe(decoders, callback);
   * if (!subscription || error) {
   *   console.error("Failed to create subscription:", error);
   * }
   * console.log("Subscription created successfully");
   * if (results.failures.length > 0) {
   *   console.warn("Some errors occurred during subscription:", results.failures);
   * }
   * console.log("Successful subscriptions:", results.successes);
   *
   * ```
   */
  public async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    protocolUseOptions?: ProtocolUseOptions,
    subscribeOptions?: SubscribeOptions
  ): Promise<SubscribeResult> {
    const uniquePubsubTopics = this.getUniquePubsubTopics(decoders);

    if (uniquePubsubTopics.length !== 1) {
      return {
        subscription: null,
        error: ProtocolError.INVALID_DECODER_TOPICS,
        results: null
      };
    }

    const pubsubTopic = uniquePubsubTopics[0];

    const { subscription, error } = await this.createSubscription(
      pubsubTopic,
      protocolUseOptions
    );

    if (error) {
      return {
        subscription: null,
        error: error,
        results: null
      };
    }

    const { failures, successes } = await subscription.subscribe(
      decoders,
      callback,
      subscribeOptions
    );
    return {
      subscription,
      error: null,
      results: {
        failures: failures,
        successes: successes
      }
    };
  }

  /**
   * Creates a new subscription to the given pubsub topic.
   * The subscription is made to multiple peers for decentralization.
   * @param pubsubTopicShardInfo The pubsub topic to subscribe to.
   * @returns The subscription object.
   */
  private async createSubscription(
    pubsubTopicShardInfo: NetworkConfig | PubsubTopic,
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

    let subscription = this.getActiveSubscription(pubsubTopic);
    if (!subscription) {
      subscription = this.setActiveSubscription(
        pubsubTopic,
        new SubscriptionManager(
          pubsubTopic,
          this.protocol,
          this._connectionManager,
          () => this.connectedPeers,
          this.renewPeer.bind(this)
        )
      );

      new MessageReliabilityMonitor(this, subscription);
    }

    return {
      error: null,
      subscription
    };
  }

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
  public async subscribeWithUnsubscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    options?: SubscribeOptions
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
