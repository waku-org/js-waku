import type { Peer } from "@libp2p/interface";
import { FilterCore } from "@waku/core";
import {
  type Callback,
  type ContentTopic,
  type IDecodedMessage,
  type IDecoder,
  type IProtoMessage,
  type PubsubTopic
} from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";
import { WakuMessage } from "@waku/proto";
import { groupByContentTopic, Logger } from "@waku/utils";

type SubscriptionCallback<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
};

const log = new Logger("sdk:filter:subscription");

export class Subscription {
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
