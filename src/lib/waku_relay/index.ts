import {
  GossipSub,
  GossipsubMessage,
  GossipsubOpts,
} from "@chainsafe/libp2p-gossipsub";
import {
  PeerIdStr,
  TopicStr,
} from "@chainsafe/libp2p-gossipsub/dist/src/types";
import { SignaturePolicy } from "@chainsafe/libp2p-gossipsub/types";
import { PublishResult } from "@libp2p/interface-pubsub";
import debug from "debug";

import { DefaultPubSubTopic } from "../constants";
import { Decoder, Encoder, Message } from "../interfaces";
import { pushOrInitMapSet } from "../push_or_init_map";
import { DecoderV0 } from "../waku_message/version_0";

import * as constants from "./constants";

const log = debug("waku:relay");

export type Callback = (msg: Message) => void;

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
export class WakuRelay extends GossipSub {
  pubSubTopic: string;
  public static multicodec: string = constants.RelayCodecs[0];

  /**
   * observers called when receiving new message.
   * Observers under key `""` are always called.
   */
  public observers: Map<string, Set<{ decoder: Decoder; callback: Callback }>>;

  constructor(options?: Partial<CreateOptions>) {
    options = Object.assign(options ?? {}, {
      // Ensure that no signature is included nor expected in the messages.
      globalSignaturePolicy: SignaturePolicy.StrictNoSign,
      fallbackToFloodsub: false,
    });
    super(options);
    this.multicodecs = constants.RelayCodecs;

    this.observers = new Map();

    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;
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
  public async send(
    encoder: Encoder,
    message: Message
  ): Promise<PublishResult> {
    const msg = await encoder.encode(message);
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
  addObserver(decoder: Decoder, callback: Callback): () => void {
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

        const decoderV0 = new DecoderV0("");
        // TODO: User might want to decide what decoder should be used (e.g. for RLN)
        const protoMsg = await decoderV0.decodeProto(event.detail.msg.data);
        if (!protoMsg) {
          return;
        }
        const contentTopic = protoMsg.contentTopic;

        if (typeof contentTopic === "undefined") {
          log("Message does not have a content topic, skipping");
          return;
        }

        const observers = this.observers.get(contentTopic);
        if (!observers) {
          return;
        }
        await Promise.all(
          Array.from(observers).map(async ({ decoder, callback }) => {
            const msg = await decoder.decode(protoMsg);
            if (msg) {
              callback(msg);
            } else {
              log("Failed to decode messages on", contentTopic);
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
