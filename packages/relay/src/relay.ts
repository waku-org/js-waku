import {
  GossipSub,
  GossipSubComponents,
  GossipsubMessage,
  GossipsubOpts
} from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";
import { SignaturePolicy } from "@chainsafe/libp2p-gossipsub/types";
import type { PubSub as Libp2pPubsub } from "@libp2p/interface";
import { sha256 } from "@noble/hashes/sha256";
import {
  ActiveSubscriptions,
  Callback,
  CreateNodeOptions,
  IAsyncIterator,
  IDecoder,
  IEncoder,
  IMessage,
  IRelay,
  Libp2p,
  ProtocolError,
  PubsubTopic,
  SDKProtocolResult
} from "@waku/interfaces";
import { isWireSizeUnderCap, toAsyncIterator } from "@waku/utils";
import { pushOrInitMapSet } from "@waku/utils";
import { Logger } from "@waku/utils";
import { pEvent } from "p-event";

import { RelayCodecs } from "./constants.js";
import { messageValidator } from "./message_validator.js";
import { TopicOnlyDecoder } from "./topic_only_message.js";

const log = new Logger("relay");

export type Observer = {
  decoder: IDecoder;
  callback: Callback;
};

export type RelayCreateOptions = CreateNodeOptions & GossipsubOpts;
export type ContentTopic = string;

type RelayConstructorParams = {
  libp2p: Libp2p;
  pubsubTopics: PubsubTopic[];
};

/**
 * Implements the [Waku v2 Relay protocol](https://rfc.vac.dev/spec/11/).
 * Throws if libp2p.pubsub does not support Waku Relay
 */
export class Relay implements IRelay {
  public readonly pubsubTopics: Set<PubsubTopic>;
  private defaultDecoder: IDecoder;

  public static multicodec: string = RelayCodecs[0];
  public readonly gossipSub: GossipSub;

  /**
   * observers called when receiving new message.
   * Observers under key `""` are always called.
   */
  private observers: Map<PubsubTopic, Map<ContentTopic, Set<unknown>>>;

  public constructor(params: RelayConstructorParams) {
    if (!this.isRelayPubsub(params.libp2p.services.pubsub)) {
      throw Error(
        `Failed to initialize Relay. libp2p.pubsub does not support ${Relay.multicodec}`
      );
    }

    this.gossipSub = params.libp2p.services.pubsub as GossipSub;
    this.pubsubTopics = new Set(params.pubsubTopics);

    if (this.gossipSub.isStarted()) {
      this.subscribeToAllTopics();
    }

    this.observers = new Map();

    // TODO: User might want to decide what decoder should be used (e.g. for RLN)
    this.defaultDecoder = new TopicOnlyDecoder(params.pubsubTopics[0]);
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
   * Wait for at least one peer with the given protocol to be connected and in the gossipsub
   * mesh for all pubsubTopics.
   */
  public async waitForPeers(): Promise<void> {
    let peers = this.getMeshPeers();
    const pubsubTopics = this.pubsubTopics;

    for (const topic of pubsubTopics) {
      while (peers.length == 0) {
        await pEvent(this.gossipSub, "gossipsub:heartbeat");
        peers = this.getMeshPeers(topic);
      }
    }
  }

  /**
   * Send Waku message.
   */
  public async send(
    encoder: IEncoder,
    message: IMessage
  ): Promise<SDKProtocolResult> {
    const { pubsubTopic } = encoder;
    if (!this.pubsubTopics.has(pubsubTopic)) {
      log.error("Failed to send waku relay: topic not configured");
      return {
        successes: [],
        failures: [
          {
            error: ProtocolError.TOPIC_NOT_CONFIGURED
          }
        ]
      };
    }

    const msg = await encoder.toWire(message);
    if (!msg) {
      log.error("Failed to encode message, aborting publish");
      return {
        successes: [],
        failures: [
          {
            error: ProtocolError.ENCODE_FAILED
          }
        ]
      };
    }

    if (!isWireSizeUnderCap(msg)) {
      log.error("Failed to send waku relay: message is bigger that 1MB");
      return {
        successes: [],
        failures: [
          {
            error: ProtocolError.SIZE_TOO_BIG
          }
        ]
      };
    }

    const { recipients } = await this.gossipSub.publish(pubsubTopic, msg);
    return {
      successes: recipients,
      failures: []
    };
  }

  public subscribeWithUnsubscribe(
    decoders: IDecoder | IDecoder[],
    callback: Callback
  ): () => void {
    const observers: Array<[PubsubTopic, Observer]> = [];

    for (const decoder of Array.isArray(decoders) ? decoders : [decoders]) {
      const { pubsubTopic } = decoder;
      const ctObs: Map<ContentTopic, Set<Observer>> = this.observers.get(
        pubsubTopic
      ) ?? new Map();
      const observer = { pubsubTopic, decoder, callback };
      pushOrInitMapSet(ctObs, decoder.contentTopic, observer);

      this.observers.set(pubsubTopic, ctObs);
      observers.push([pubsubTopic, observer]);
    }

    return () => {
      this.removeObservers(observers);
    };
  }

  public subscribe = this.subscribeWithUnsubscribe;

  private removeObservers(observers: Array<[PubsubTopic, Observer]>): void {
    for (const [pubsubTopic, observer] of observers) {
      const ctObs = this.observers.get(pubsubTopic);
      if (!ctObs) continue;

      const contentTopic = observer.decoder.contentTopic;
      const _obs = ctObs.get(contentTopic);
      if (!_obs) continue;

      _obs.delete(observer);
      ctObs.set(contentTopic, _obs);
      this.observers.set(pubsubTopic, ctObs);
    }
  }

  public toSubscriptionIterator(
    decoders: IDecoder | IDecoder[]
  ): Promise<IAsyncIterator> {
    return toAsyncIterator(this, decoders);
  }

  public getActiveSubscriptions(): ActiveSubscriptions {
    const map = new Map();
    for (const pubsubTopic of this.pubsubTopics) {
      map.set(pubsubTopic, Array.from(this.observers.keys()));
    }
    return map;
  }

  public getMeshPeers(topic?: TopicStr): PeerIdStr[] {
    // if no TopicStr is provided - returns empty array
    return this.gossipSub.getMeshPeers(topic || "");
  }

  private subscribeToAllTopics(): void {
    for (const pubsubTopic of this.pubsubTopics) {
      this.gossipSubSubscribe(pubsubTopic);
    }
  }

  private async processIncomingMessage(
    pubsubTopic: string,
    bytes: Uint8Array
  ): Promise<void> {
    const topicOnlyMsg = await this.defaultDecoder.fromWireToProtoObj(bytes);
    if (!topicOnlyMsg || !topicOnlyMsg.contentTopic) {
      log.warn("Message does not have a content topic, skipping");
      return;
    }

    // Retrieve the map of content topics for the given pubsubTopic
    const contentTopicMap = this.observers.get(pubsubTopic);
    if (!contentTopicMap) {
      return;
    }

    // Retrieve the set of observers for the given contentTopic
    const observers = contentTopicMap.get(
      topicOnlyMsg.contentTopic
    ) as Set<Observer>;
    if (!observers) {
      return;
    }

    await Promise.all(
      Array.from(observers).map(({ decoder, callback }) => {
        return (async () => {
          try {
            const protoMsg = await decoder.fromWireToProtoObj(bytes);
            if (!protoMsg) {
              log.error(
                "Internal error: message previously decoded failed on 2nd pass."
              );
              return;
            }
            const msg = await decoder.fromProtoObj(pubsubTopic, protoMsg);
            if (msg) {
              await callback(msg);
            } else {
              log.error(
                "Failed to decode messages on",
                topicOnlyMsg.contentTopic
              );
            }
          } catch (error) {
            log.error("Error while decoding message:", error);
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
  private gossipSubSubscribe(pubsubTopic: string): void {
    this.gossipSub.addEventListener(
      "gossipsub:message",
      (event: CustomEvent<GossipsubMessage>) => {
        if (event.detail.msg.topic !== pubsubTopic) return;

        this.processIncomingMessage(
          event.detail.msg.topic,
          event.detail.msg.data
        ).catch((e) => log.error("Failed to process incoming message", e));
      }
    );

    this.gossipSub.topicValidators.set(pubsubTopic, messageValidator);
    this.gossipSub.subscribe(pubsubTopic);
  }

  private isRelayPubsub(pubsub: Libp2pPubsub | undefined): boolean {
    return pubsub?.multicodecs?.includes(Relay.multicodec) ?? false;
  }
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
