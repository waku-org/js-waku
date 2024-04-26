import type { Peer } from "@libp2p/interface";
import { FilterCore } from "@waku/core";
import type {
  Callback,
  ContentTopic,
  IAsyncIterator,
  IDecodedMessage,
  IDecoder,
  IFilterSDK,
  IProtoMessage,
  Libp2p,
  ProtocolCreateOptions,
  PubsubTopic,
  ShardingParams,
  Unsubscribe
} from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";
import { WakuMessage } from "@waku/proto";
import {
  ensurePubsubTopicIsConfigured,
  groupByContentTopic,
  Logger,
  shardInfoToPubsubTopics,
  toAsyncIterator
} from "@waku/utils";

import { BaseProtocolSDK } from "./base_protocol";

type SubscriptionCallback<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
};

const log = new Logger("sdk:filter");

export class SubscriptionManager {
  private readonly pubsubTopic: PubsubTopic;
  readonly peers: Peer[];
  readonly receivedMessagesHashStr: string[] = [];

  private subscriptionCallbacks: Map<
    ContentTopic,
    SubscriptionCallback<IDecodedMessage>
  >;

  constructor(
    pubsubTopic: PubsubTopic,
    remotePeers: Peer[],
    private protocol: FilterCore
  ) {
    this.peers = remotePeers;
    this.pubsubTopic = pubsubTopic;
    this.subscriptionCallbacks = new Map();
  }

  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<void> {
    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];

    // check that all decoders are configured for the same pubsub topic as this subscription
    decodersArray.forEach((decoder) => {
      if (decoder.pubsubTopic !== this.pubsubTopic) {
        throw new Error(
          `Pubsub topic not configured: decoder is configured for pubsub topic ${decoder.pubsubTopic} but this subscription is for pubsub topic ${this.pubsubTopic}. Please create a new Subscription for the different pubsub topic.`
        );
      }
    });

    const decodersGroupedByCT = groupByContentTopic(decodersArray);
    const contentTopics = Array.from(decodersGroupedByCT.keys());

    const promises = this.peers.map(async (peer) => {
      await this.protocol.subscribe(this.pubsubTopic, peer, contentTopics);
    });

    const results = await Promise.allSettled(promises);

    this.handleErrors(results, "subscribe");

    // Save the callback functions by content topics so they
    // can easily be removed (reciprocally replaced) if `unsubscribe` (reciprocally `subscribe`)
    // is called for those content topics
    decodersGroupedByCT.forEach((decoders, contentTopic) => {
      // Cast the type because a given `subscriptionCallbacks` map may hold
      // Decoder that decode to different implementations of `IDecodedMessage`
      const subscriptionCallback = {
        decoders,
        callback
      } as unknown as SubscriptionCallback<IDecodedMessage>;

      // The callback and decoder may override previous values, this is on
      // purpose as the user may call `subscribe` to refresh the subscription
      this.subscriptionCallbacks.set(contentTopic, subscriptionCallback);
    });
  }

  async unsubscribe(contentTopics: ContentTopic[]): Promise<void> {
    const promises = this.peers.map(async (peer) => {
      await this.protocol.unsubscribe(this.pubsubTopic, peer, contentTopics);

      contentTopics.forEach((contentTopic: string) => {
        this.subscriptionCallbacks.delete(contentTopic);
      });
    });

    const results = await Promise.allSettled(promises);

    this.handleErrors(results, "unsubscribe");
  }

  async ping(): Promise<void> {
    const promises = this.peers.map(async (peer) => {
      await this.protocol.ping(peer);
    });

    const results = await Promise.allSettled(promises);

    this.handleErrors(results, "ping");
  }

  async unsubscribeAll(): Promise<void> {
    const promises = this.peers.map(async (peer) => {
      await this.protocol.unsubscribeAll(this.pubsubTopic, peer);
    });

    const results = await Promise.allSettled(promises);

    this.subscriptionCallbacks.clear();

    this.handleErrors(results, "unsubscribeAll");
  }

  async processIncomingMessage(message: WakuMessage): Promise<void> {
    const hashedMessageStr = messageHashStr(
      this.pubsubTopic,
      message as IProtoMessage
    );
    if (this.receivedMessagesHashStr.includes(hashedMessageStr)) {
      log.info("Message already received, skipping");
      return;
    }
    this.receivedMessagesHashStr.push(hashedMessageStr);

    const { contentTopic } = message;
    const subscriptionCallback = this.subscriptionCallbacks.get(contentTopic);
    if (!subscriptionCallback) {
      log.error("No subscription callback available for ", contentTopic);
      return;
    }
    log.info(
      "Processing message with content topic ",
      contentTopic,
      " on pubsub topic ",
      this.pubsubTopic
    );
    await pushMessage(subscriptionCallback, this.pubsubTopic, message);
  }

  // Filter out only the rejected promises and extract & handle their reasons
  private handleErrors(
    results: PromiseSettledResult<void>[],
    type: "ping" | "subscribe" | "unsubscribe" | "unsubscribeAll"
  ): void {
    const errors = results
      .filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      )
      .map((rejectedResult) => rejectedResult.reason);

    if (errors.length === this.peers.length) {
      const errorCounts = new Map<string, number>();
      // TODO: streamline error logging with https://github.com/orgs/waku-org/projects/2/views/1?pane=issue&itemId=42849952
      errors.forEach((error) => {
        const message = error instanceof Error ? error.message : String(error);
        errorCounts.set(message, (errorCounts.get(message) || 0) + 1);
      });

      const uniqueErrorMessages = Array.from(
        errorCounts,
        ([message, count]) => `${message} (occurred ${count} times)`
      ).join(", ");
      throw new Error(`Error ${type} all peers: ${uniqueErrorMessages}`);
    } else if (errors.length > 0) {
      // TODO: handle renewing faulty peers with new peers (https://github.com/waku-org/js-waku/issues/1463)
      log.warn(
        `Some ${type} failed. These will be refreshed with new peers`,
        errors
      );
    } else {
      log.info(`${type} successful for all peers`);
    }
  }
}

class FilterSDK extends BaseProtocolSDK implements IFilterSDK {
  public readonly protocol: FilterCore;

  private activeSubscriptions = new Map<string, SubscriptionManager>();
  private async handleIncomingMessage(
    pubsubTopic: PubsubTopic,
    wakuMessage: WakuMessage
  ): Promise<void> {
    const subscription = this.getActiveSubscription(pubsubTopic);
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
  async createSubscription(
    pubsubTopicShardInfo: ShardingParams | PubsubTopic
  ): Promise<SubscriptionManager> {
    const pubsubTopic =
      typeof pubsubTopicShardInfo == "string"
        ? pubsubTopicShardInfo
        : shardInfoToPubsubTopics(pubsubTopicShardInfo)?.[0];

    ensurePubsubTopicIsConfigured(pubsubTopic, this.protocol.pubsubTopics);

    const peers = await this.protocol.getPeers();
    if (peers.length === 0) {
      throw new Error("No peer found to initiate subscription.");
    }

    log.info(
      `Creating filter subscription with ${peers.length} peers: `,
      peers.map((peer) => peer.id.toString())
    );

    const subscription =
      this.getActiveSubscription(pubsubTopic) ??
      this.setActiveSubscription(
        pubsubTopic,
        new SubscriptionManager(pubsubTopic, peers, this.protocol)
      );

    return subscription;
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
    const pubsubTopics = this.getPubsubTopics<T>(decoders);

    if (pubsubTopics.length === 0) {
      throw Error(
        "Failed to subscribe: no pubsubTopic found on decoders provided."
      );
    }

    if (pubsubTopics.length > 1) {
      throw Error(
        "Failed to subscribe: all decoders should have the same pubsub topic. Use createSubscription to be more agile."
      );
    }

    const subscription = await this.createSubscription(pubsubTopics[0]);

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

  private getPubsubTopics<T extends IDecodedMessage>(
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
  init: ProtocolCreateOptions
): (libp2p: Libp2p) => IFilterSDK {
  return (libp2p: Libp2p) => new FilterSDK(libp2p, init);
}

async function pushMessage<T extends IDecodedMessage>(
  subscriptionCallback: SubscriptionCallback<T>,
  pubsubTopic: PubsubTopic,
  message: WakuMessage
): Promise<void> {
  const { decoders, callback } = subscriptionCallback;

  const { contentTopic } = message;
  if (!contentTopic) {
    log.warn("Message has no content topic, skipping");
    return;
  }

  try {
    const decodePromises = decoders.map((dec) =>
      dec
        .fromProtoObj(pubsubTopic, message as IProtoMessage)
        .then((decoded) => decoded || Promise.reject("Decoding failed"))
    );

    const decodedMessage = await Promise.any(decodePromises);

    await callback(decodedMessage);
  } catch (e) {
    log.error("Error decoding message", e);
  }
}
