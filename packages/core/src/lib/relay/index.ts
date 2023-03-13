import {
  GossipSub,
  GossipSubComponents,
  GossipsubMessage,
  GossipsubOpts,
} from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";
import { SignaturePolicy } from "@chainsafe/libp2p-gossipsub/types";
import { CustomEvent } from "@libp2p/interfaces/events";
import {
  Callback,
  IDecoder,
  IEncoder,
  IMessage,
  IRelay,
  ProtocolCreateOptions,
  SendResult,
} from "@waku/interfaces";
import { IDecodedMessage } from "@waku/interfaces";
import debug from "debug";

import { DefaultPubSubTopic } from "../constants.js";
import { TopicOnlyDecoder } from "../message/topic_only_message.js";
import { pushOrInitMapSet } from "../push_or_init_map.js";

import * as constants from "./constants.js";
import { messageValidator } from "./message_validator.js";

const log = debug("waku:relay");

export type Observer<T extends IDecodedMessage> = {
  decoder: IDecoder<T>;
  callback: Callback<T>;
};

export type RelayCreateOptions = ProtocolCreateOptions & GossipsubOpts;
export type ContentTopic = string;

type BasicEventPayload = {
  contentTopic: Pick<IDecoder, "contentTopic">;
};

/**
 * Implements the [Waku v2 Relay protocol](https://rfc.vac.dev/spec/11/).
 * Must be passed as a `pubsub` module to a `Libp2p` instance.
 *
 * @implements {require('libp2p-interfaces/src/pubsub')}
 */
class Relay extends GossipSub implements IRelay {
  private readonly pubSubTopic: string;
  defaultDecoder: IDecoder<IDecodedMessage>;
  public static multicodec: string = constants.RelayCodecs[0];

  /**
   * observers called when receiving new message.
   * Observers under key `""` are always called.
   */
  public observers: Map<ContentTopic, Set<unknown>>;

  constructor(
    components: GossipSubComponents,
    options?: Partial<RelayCreateOptions>
  ) {
    options = Object.assign(options ?? {}, {
      // Ensure that no signature is included nor expected in the messages.
      globalSignaturePolicy: SignaturePolicy.StrictNoSign,
      fallbackToFloodsub: false,
    });

    super(components, options);
    this.multicodecs = constants.RelayCodecs;

    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;

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
    await super.start();
    this.subscribe(this.pubSubTopic);
  }

  /**
   * Send Waku message.
   */
  public async send(encoder: IEncoder, message: IMessage): Promise<SendResult> {
    const msg = await encoder.toWire(message);
    if (!msg) {
      log("Failed to encode message, aborting publish");
      return { recipients: [] };
    }

    return this.publish(this.pubSubTopic, msg);
  }

  /**
   * Add an observer and associated Decoder to process incoming messages on a given content topic.
   *
   * @returns Function to delete the observer
   */
  addObserver<T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ): () => void {
    const observer = {
      decoder,
      callback,
    };
    const contentTopic = decoder.contentTopic;

    pushOrInitMapSet(this.observers, contentTopic, observer);

    this.dispatchEvent(
      new CustomEvent<BasicEventPayload>("observer:added", {
        detail: {
          contentTopic,
        },
      })
    );

    return () => {
      const observers = this.observers.get(contentTopic);
      if (observers) {
        observers.delete(observer);

        this.dispatchEvent(
          new CustomEvent<BasicEventPayload>("observer:removed", {
            detail: {
              contentTopic,
            },
          })
        );
      }
    };
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
      Array.from(observers).map(async ({ decoder, callback }) => {
        const protoMsg = await decoder.fromWireToProtoObj(bytes);
        if (!protoMsg) {
          log("Internal error: message previously decoded failed on 2nd pass.");
          return;
        }
        const msg = await decoder.fromProtoObj(pubSubTopic, protoMsg);
        if (msg) {
          callback(msg);
        } else {
          log("Failed to decode messages on", topicOnlyMsg.contentTopic);
        }
      })
    );
  }

  /**
   * Subscribe to a pubsub topic and start emitting Waku messages to observers.
   *
   * @override
   */
  subscribe(pubSubTopic: string): void {
    this.addEventListener(
      "gossipsub:message",
      async (event: CustomEvent<GossipsubMessage>) => {
        if (event.detail.msg.topic !== pubSubTopic) return;
        log(`Message received on ${pubSubTopic}`);

        this.processIncomingMessage(
          event.detail.msg.topic,
          event.detail.msg.data
        ).catch((e) => log("Failed to process incoming message", e));
      }
    );

    this.topicValidators.set(pubSubTopic, messageValidator);
    super.subscribe(pubSubTopic);
  }

  unsubscribe(pubSubTopic: TopicStr): void {
    super.unsubscribe(pubSubTopic);
    this.topicValidators.delete(pubSubTopic);
  }

  getMeshPeers(topic?: TopicStr): PeerIdStr[] {
    return super.getMeshPeers(topic ?? this.pubSubTopic);
  }
}

Relay.multicodec = constants.RelayCodecs[constants.RelayCodecs.length - 1];

export function wakuRelay(
  init: Partial<RelayCreateOptions> = {}
): (components: GossipSubComponents) => IRelay {
  return (components: GossipSubComponents) => new Relay(components, init);
}
