import {
  GossipSub,
  GossipSubComponents,
  GossipsubMessage,
  GossipsubOpts,
} from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";
import { SignaturePolicy } from "@chainsafe/libp2p-gossipsub/types";
import type {
  Callback,
  IDecoder,
  IEncoder,
  IMessage,
  IRelay,
  SendResult,
} from "@waku/interfaces";
import { IDecodedMessage } from "@waku/interfaces";
import debug from "debug";

import { DefaultPubSubTopic } from "../constants.js";
import { pushOrInitMapSet } from "../push_or_init_map.js";
import { TopicOnlyDecoder } from "../waku_message/topic_only_message.js";

import * as constants from "./constants.js";

const log = debug("waku:relay");

export type Observer<T extends IDecodedMessage> = {
  decoder: IDecoder<T>;
  callback: Callback<T>;
};

export type CreateOptions = {
  /**
   * The PubSub Topic to use. Defaults to {@link DefaultPubSubTopic}.
   *
   * One and only one pubsub topic is used by Waku. This is used by:
   * - WakuRelay to receive, route and send messages,
   * - WakuLightPush to send messages,
   * - WakuStore to retrieve messages.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   * @default {@link DefaultPubSubTopic}
   */
  pubSubTopic?: string;
} & GossipsubOpts;

/**
 * Implements the [Waku v2 Relay protocol](https://rfc.vac.dev/spec/11/).
 * Must be passed as a `pubsub` module to a `Libp2p` instance.
 *
 * @implements {require('libp2p-interfaces/src/pubsub')}
 */
class WakuRelay extends GossipSub implements IRelay {
  pubSubTopic: string;
  defaultDecoder: IDecoder<IDecodedMessage>;
  public static multicodec: string = constants.RelayCodecs[0];

  /**
   * observers called when receiving new message.
   * Observers under key `""` are always called.
   */
  public observers: Map<string, Set<Observer<any>>>;

  constructor(
    components: GossipSubComponents,
    options?: Partial<CreateOptions>
  ) {
    options = Object.assign(options ?? {}, {
      // Ensure that no signature is included nor expected in the messages.
      globalSignaturePolicy: SignaturePolicy.StrictNoSign,
      fallbackToFloodsub: false,
    });
    super(components, options);
    this.multicodecs = constants.RelayCodecs;

    this.observers = new Map();

    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;

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
    pushOrInitMapSet(this.observers, decoder.contentTopic, observer);

    return () => {
      const observers = this.observers.get(decoder.contentTopic);
      if (observers) {
        observers.delete(observer);
      }
    };
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

        const topicOnlyMsg = await this.defaultDecoder.fromWireToProtoObj(
          event.detail.msg.data
        );
        if (!topicOnlyMsg || !topicOnlyMsg.contentTopic) {
          log("Message does not have a content topic, skipping");
          return;
        }

        const observers = this.observers.get(topicOnlyMsg.contentTopic);
        if (!observers) {
          return;
        }
        await Promise.all(
          Array.from(observers).map(async ({ decoder, callback }) => {
            const protoMsg = await decoder.fromWireToProtoObj(
              event.detail.msg.data
            );
            if (!protoMsg) {
              log(
                "Internal error: message previously decoded failed on 2nd pass."
              );
              return;
            }
            const msg = await decoder.fromProtoObj(protoMsg);
            if (msg) {
              callback(msg);
            } else {
              log("Failed to decode messages on", topicOnlyMsg.contentTopic);
            }
          })
        );
      }
    );

    super.subscribe(pubSubTopic);
  }

  getMeshPeers(topic?: TopicStr): PeerIdStr[] {
    return super.getMeshPeers(topic ?? this.pubSubTopic);
  }
}

WakuRelay.multicodec = constants.RelayCodecs[constants.RelayCodecs.length - 1];

export function wakuRelay(
  init: Partial<CreateOptions> = {}
): (components: GossipSubComponents) => IRelay {
  return (components: GossipSubComponents) => new WakuRelay(components, init);
}
