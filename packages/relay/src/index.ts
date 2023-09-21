import {
  GossipSub,
  GossipSubComponents,
  GossipsubMessage,
  GossipsubOpts
} from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";
import { SignaturePolicy } from "@chainsafe/libp2p-gossipsub/types";
import type { PeerId } from "@libp2p/interface/peer-id";
import type { PubSub } from "@libp2p/interface/pubsub";
import { sha256 } from "@noble/hashes/sha256";
import { DefaultPubSubTopic } from "@waku/core";
import {
  ActiveSubscriptions,
  Callback,
  IAsyncIterator,
  IDecodedMessage,
  IDecoder,
  IEncoder,
  IMessage,
  IRelay,
  Libp2p,
  ProtocolCreateOptions,
  PubSubTopic,
  SendError,
  SendResult
} from "@waku/interfaces";
import { groupByContentTopic, isSizeValid, toAsyncIterator } from "@waku/utils";
import debug from "debug";

import { RelayCodecs } from "./constants.js";
import { messageValidator } from "./message_validator.js";
import { TopicOnlyDecoder } from "./topic_only_message.js";

const log = debug("waku:relay");

export type Observer<T extends IDecodedMessage> = {
  pubsubTopic: PubSubTopic;
  decoder: IDecoder<T>;
  callback: Callback<T>;
};

export type RelayCreateOptions = ProtocolCreateOptions & GossipsubOpts;
export type ContentTopic = string;

/**
 * Implements the [Waku v2 Relay protocol](https://rfc.vac.dev/spec/11/).
 * Throws if libp2p.pubsub does not support Waku Relay
 */
class Relay implements IRelay {
  readonly pubSubTopics: Set<string>;
  private defaultDecoder: IDecoder<IDecodedMessage>;

  public static multicodec: string = RelayCodecs[0];
  public readonly gossipSub: GossipSub;

  /**
   * observers called when receiving new message.
   * Observers under key `""` are always called.
   */
  private observers: Map<PubSubTopic, Map<ContentTopic, Set<unknown>>>;

  constructor(libp2p: Libp2p, options?: Partial<RelayCreateOptions>) {
    if (!this.isRelayPubSub(libp2p.services.pubsub)) {
      throw Error(
        `Failed to initialize Relay. libp2p.pubsub does not support ${Relay.multicodec}`
      );
    }

    this.gossipSub = libp2p.services.pubsub as GossipSub;
    this.pubSubTopics = new Set(options?.pubSubTopics ?? [DefaultPubSubTopic]);

    if (this.gossipSub.isStarted()) {
      this.subscribeToAllTopics();
    }

    this.observers = new Map();

    // Default PubSubTopic decoder
    // TODO: User might want to decide what decoder should be used (e.g. for RLN)
    this.defaultDecoder = new TopicOnlyDecoder();
  }

  /**
   * Mounts the gossipsub protocol onto the libp2p node
   * and subscribes to all the topics.
   *
   * @override
   * @returns {void}
   */
  public async start(): Promise<void> {
    if (this.gossipSub.isStarted()) {
      throw Error("GossipSub already started.");
    }

    await this.gossipSub.start();
    this.subscribeToAllTopics();
  }

  /**
   * Send Waku message.
   */
  public async send(encoder: IEncoder, message: IMessage): Promise<SendResult> {
    const recipients: PeerId[] = [];

    const { pubSubTopic } = encoder;
    if (!this.pubSubTopics.has(pubSubTopic)) {
      log("Failed to send waku relay: topic not configured");
      return {
        recipients,
        errors: [SendError.TOPIC_NOT_CONFIGURED]
      };
    }

    if (!isSizeValid(message.payload)) {
      log("Failed to send waku relay: message is bigger that 1MB");
      return {
        recipients,
        errors: [SendError.SIZE_TOO_BIG]
      };
    }

    const msg = await encoder.toWire(message);
    if (!msg) {
      log("Failed to encode message, aborting publish");
      return {
        recipients,
        errors: [SendError.ENCODE_FAILED]
      };
    }

    return await this.gossipSub.publish(pubSubTopic, msg);
  }

  public subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): () => void {
    const pubSubTopicToContentObservers = Array.isArray(decoders)
      ? toObservers(Array.from(this.pubSubTopics), decoders, callback)
      : toObservers(Array.from(this.pubSubTopics), [decoders], callback);

    for (const [
      pubSubTopic,
      contentTopicToObservers
    ] of pubSubTopicToContentObservers.entries()) {
      const existingContentObservers =
        this.observers.get(pubSubTopic) ||
        new Map<ContentTopic, Set<Observer<T>>>();

      for (const [
        contentTopic,
        newObservers
      ] of contentTopicToObservers.entries()) {
        const currObservers =
          existingContentObservers.get(contentTopic) ?? new Set<Observer<T>>();
        existingContentObservers.set(
          contentTopic,
          union(currObservers, newObservers)
        );
      }

      this.observers.set(pubSubTopic, existingContentObservers);
    }

    return () => {
      for (const [
        pubSubTopic,
        contentTopicToObservers
      ] of pubSubTopicToContentObservers.entries()) {
        const existingContentObservers = this.observers.get(pubSubTopic);

        if (existingContentObservers) {
          for (const [
            contentTopic,
            observersToRemove
          ] of contentTopicToObservers.entries()) {
            const currentObservers =
              existingContentObservers.get(contentTopic) ||
              new Set<Observer<T>>();
            const nextObservers = leftMinusJoin(
              currentObservers,
              observersToRemove
            );

            if (nextObservers.size) {
              existingContentObservers.set(contentTopic, nextObservers);
            } else {
              existingContentObservers.delete(contentTopic);
            }
          }

          if (existingContentObservers.size) {
            this.observers.set(pubSubTopic, existingContentObservers);
          } else {
            this.observers.delete(pubSubTopic);
          }
        }
      }
    };
  }

  public toSubscriptionIterator<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): Promise<IAsyncIterator<T>> {
    return toAsyncIterator(this, decoders);
  }

  public getActiveSubscriptions(): ActiveSubscriptions {
    const map = new Map();
    for (const pubSubTopic of this.pubSubTopics) {
      map.set(pubSubTopic, Array.from(this.observers.keys()));
    }
    return map;
  }

  /**
   * Returns mesh peers for all topics.
   * @returns Map of topic to peer ids
   */
  public getMeshPeers(): Map<TopicStr, PeerIdStr[]> {
    const map = new Map<TopicStr, PeerIdStr[]>();
    for (const topic of this.pubSubTopics) {
      map.set(topic, Array.from(this.gossipSub.mesh.get(topic) ?? []));
    }
    return map;
  }

  private subscribeToAllTopics(): void {
    for (const pubSubTopic of this.pubSubTopics) {
      this.gossipSubSubscribe(pubSubTopic);
    }
  }

  private async processIncomingMessage<T extends IDecodedMessage>(
    pubSubTopic: string,
    bytes: Uint8Array
  ): Promise<void> {
    const topicOnlyMsg = await this.defaultDecoder.fromWireToProtoObj(bytes);
    if (!topicOnlyMsg || !topicOnlyMsg.contentTopic) {
      log("Message does not have a content topic, skipping");
      return;
    }

    // Retrieve the map of content topics for the given pubSubTopic
    const contentTopicMap = this.observers.get(pubSubTopic);
    if (!contentTopicMap) {
      return;
    }

    // Retrieve the set of observers for the given contentTopic
    const observers = contentTopicMap.get(topicOnlyMsg.contentTopic) as Set<
      Observer<T>
    >;
    if (!observers) {
      return;
    }

    await Promise.all(
      Array.from(observers).map(({ decoder, callback }) => {
        return (async () => {
          try {
            const protoMsg = await decoder.fromWireToProtoObj(bytes);
            if (!protoMsg) {
              log(
                "Internal error: message previously decoded failed on 2nd pass."
              );
              return;
            }
            const msg = await decoder.fromProtoObj(pubSubTopic, protoMsg);
            if (msg) {
              await callback(msg);
            } else {
              log("Failed to decode messages on", topicOnlyMsg.contentTopic);
            }
          } catch (error) {
            log("Error while decoding message:", error);
          }
        })();
      })
    );
  }

  /**
   * Subscribe to a pubsub topic and start emitting Waku messages to observers.
   *
   * @override
   */
  private gossipSubSubscribe(pubSubTopic: string): void {
    this.gossipSub.addEventListener(
      "gossipsub:message",
      (event: CustomEvent<GossipsubMessage>) => {
        if (event.detail.msg.topic !== pubSubTopic) return;
        log(`Message received on ${pubSubTopic}`);

        this.processIncomingMessage(
          event.detail.msg.topic,
          event.detail.msg.data
        ).catch((e) => log("Failed to process incoming message", e));
      }
    );

    this.gossipSub.topicValidators.set(pubSubTopic, messageValidator);
    this.gossipSub.subscribe(pubSubTopic);
  }

  private isRelayPubSub(pubsub: PubSub | undefined): boolean {
    return pubsub?.multicodecs?.includes(Relay.multicodec) || false;
  }
}

export function wakuRelay(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => IRelay {
  return (libp2p: Libp2p) => new Relay(libp2p, init);
}

export function wakuGossipSub(
  init: Partial<RelayCreateOptions> = {}
): (components: GossipSubComponents) => GossipSub {
  return (components: GossipSubComponents) => {
    init = {
      ...init,
      msgIdFn: ({ data }) => sha256(data),
      // Ensure that no signature is included nor expected in the messages.
      globalSignaturePolicy: SignaturePolicy.StrictNoSign,
      fallbackToFloodsub: false
    };
    const pubsub = new GossipSub(components, init);
    pubsub.multicodecs = RelayCodecs;
    return pubsub;
  };
}

function toObservers<T extends IDecodedMessage>(
  allPubSubTopics: PubSubTopic[],
  decoders: IDecoder<T>[],
  callback: Callback<T>
): Map<PubSubTopic, Map<ContentTopic, Set<Observer<T>>>> {
  for (const decoder of decoders) {
    if (!allPubSubTopics.includes(decoder.pubSubTopic)) {
      throw new Error(
        `PubSub topic ${decoder.pubSubTopic} is not supported by this protocol. Configured topics are: ${allPubSubTopics}. Please update your configuration by passing in the topic during Waku node instantiation.`
      );
    }
  }

  const finalMap = new Map<PubSubTopic, Map<ContentTopic, Set<Observer<T>>>>();

  for (const pubSubTopic of allPubSubTopics) {
    // Filter decoders that match the current pubSubTopic
    const filteredDecoders = decoders.filter(
      (decoder) => decoder.pubSubTopic === pubSubTopic
    );

    // Group these decoders by ContentTopic
    const contentTopicToDecoders = Array.from(
      groupByContentTopic(filteredDecoders).entries()
    );

    const contentTopicToObserversMap = new Map<
      ContentTopic,
      Set<Observer<T>>
    >();

    for (const [contentTopic, topicDecoders] of contentTopicToDecoders) {
      const observersSet = new Set<Observer<T>>(
        topicDecoders.map((decoder) => ({
          decoder,
          callback
        })) as Observer<T>[]
      );
      contentTopicToObserversMap.set(contentTopic, observersSet);
    }

    // Set the result in the final map
    finalMap.set(pubSubTopic, contentTopicToObserversMap);
  }

  return finalMap;
}

function union(left: Set<unknown>, right: Set<unknown>): Set<unknown> {
  for (const val of right.values()) {
    left.add(val);
  }
  return left;
}

function leftMinusJoin(left: Set<unknown>, right: Set<unknown>): Set<unknown> {
  for (const val of right.values()) {
    if (left.has(val)) {
      left.delete(val);
    }
  }
  return left;
}
