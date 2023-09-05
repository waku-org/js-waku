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
  private readonly pubSubTopic: string;
  private defaultDecoder: IDecoder<IDecodedMessage>;

  public static multicodec: string = RelayCodecs[0];
  public readonly gossipSub: GossipSub;

  /**
   * observers called when receiving new message.
   * Observers under key `""` are always called.
   */
  private observers: Map<ContentTopic, Set<unknown>>;

  constructor(libp2p: Libp2p, options?: Partial<RelayCreateOptions>) {
    if (!this.isRelayPubSub(libp2p.services.pubsub)) {
      throw Error(
        `Failed to initialize Relay. libp2p.pubsub does not support ${Relay.multicodec}`
      );
    }

    this.gossipSub = libp2p.services.pubsub as GossipSub;
    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;

    if (this.gossipSub.isStarted()) {
      this.gossipSubSubscribe(this.pubSubTopic);
    }

    this.observers = new Map();

    // TODO: User might want to decide what decoder should be used (e.g. for RLN)
    this.defaultDecoder = new TopicOnlyDecoder();
  }

  /**
   * Mounts the gossipsub protocol onto the libp2p node
   * and subscribes to the default topic.
   *
   * @override
   * @returns {void}
   */
  public async start(): Promise<void> {
    if (this.gossipSub.isStarted()) {
      throw Error("GossipSub already started.");
    }

    await this.gossipSub.start();
    this.gossipSubSubscribe(this.pubSubTopic);
  }

  /**
   * Send Waku message.
   */
  public async send(encoder: IEncoder, message: IMessage): Promise<SendResult> {
    const recipients: PeerId[] = [];
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

    return this.gossipSub.publish(this.pubSubTopic, msg);
  }

  /**
   * Add an observer and associated Decoder to process incoming messages on a given content topic.
   *
   * @returns Function to delete the observer
   */
  public subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): () => void {
    const contentTopicToObservers = Array.isArray(decoders)
      ? toObservers(decoders, callback)
      : toObservers([decoders], callback);

    for (const contentTopic of contentTopicToObservers.keys()) {
      const currObservers = this.observers.get(contentTopic) || new Set();
      const newObservers =
        contentTopicToObservers.get(contentTopic) || new Set();

      this.observers.set(contentTopic, union(currObservers, newObservers));
    }

    return () => {
      for (const contentTopic of contentTopicToObservers.keys()) {
        const currentObservers = this.observers.get(contentTopic) || new Set();
        const observersToRemove =
          contentTopicToObservers.get(contentTopic) || new Set();

        const nextObservers = leftMinusJoin(
          currentObservers,
          observersToRemove
        );

        if (nextObservers.size) {
          this.observers.set(contentTopic, nextObservers);
        } else {
          this.observers.delete(contentTopic);
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
    map.set(this.pubSubTopic, this.observers.keys());
    return map;
  }

  public getMeshPeers(topic?: TopicStr): PeerIdStr[] {
    return this.gossipSub.getMeshPeers(topic ?? this.pubSubTopic);
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

    const observers = this.observers.get(topicOnlyMsg.contentTopic) as Set<
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
  decoders: IDecoder<T>[],
  callback: Callback<T>
): Map<ContentTopic, Set<Observer<T>>> {
  const contentTopicToDecoders = Array.from(
    groupByContentTopic(decoders).entries()
  );

  const contentTopicToObserversEntries = contentTopicToDecoders.map(
    ([contentTopic, decoders]) =>
      [
        contentTopic,
        new Set(
          decoders.map(
            (decoder) =>
              ({
                decoder,
                callback
              }) as Observer<T>
          )
        )
      ] as [ContentTopic, Set<Observer<T>>]
  );

  return new Map(contentTopicToObserversEntries);
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
