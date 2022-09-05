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
import debug from "debug";

import { DefaultPubSubTopic } from "../constants";
import { hexToBytes } from "../utils";
import { DecryptionMethod, WakuMessage } from "../waku_message";

import * as constants from "./constants";

const dbg = debug("waku:relay");

export interface CreateOptions {
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
  decryptionKeys?: Array<Uint8Array | string>;
}

/**
 * Implements the [Waku v2 Relay protocol](https://rfc.vac.dev/spec/11/).
 * Must be passed as a `pubsub` module to a `Libp2p` instance.
 *
 * @implements {require('libp2p-interfaces/src/pubsub')}
 */
export class WakuRelay extends GossipSub {
  pubSubTopic: string;
  public static multicodec: string = constants.RelayCodecs[0];

  public decryptionKeys: Map<
    Uint8Array,
    { method?: DecryptionMethod; contentTopics?: string[] }
  >;

  /**
   * observers called when receiving new message.
   * Observers under key `""` are always called.
   */
  public observers: {
    [contentTopic: string]: Set<(message: WakuMessage) => void>;
  };

  constructor(options?: Partial<CreateOptions & GossipsubOpts>) {
    options = Object.assign(options ?? {}, {
      // Ensure that no signature is included nor expected in the messages.
      globalSignaturePolicy: SignaturePolicy.StrictNoSign,
      fallbackToFloodsub: false,
    });
    super(options);
    this.multicodecs = constants.RelayCodecs;

    this.observers = {};
    this.decryptionKeys = new Map();

    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;

    options?.decryptionKeys?.forEach((key) => {
      this.addDecryptionKey(key);
    });
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
   *
   * @param {WakuMessage} message
   * @returns {Promise<void>}
   */
  public async send(message: WakuMessage): Promise<void> {
    const msg = message.encode();
    await this.publish(this.pubSubTopic, msg);
  }

  /**
   * Register a decryption key to attempt decryption of received messages.
   * This can either be a private key for asymmetric encryption or a symmetric
   * key. `WakuRelay` will attempt to decrypt messages using both methods.
   *
   * Strings must be in hex format.
   */
  addDecryptionKey(
    key: Uint8Array | string,
    options?: { method?: DecryptionMethod; contentTopics?: string[] }
  ): void {
    this.decryptionKeys.set(hexToBytes(key), options ?? {});
  }

  /**
   * Delete a decryption key that was used to attempt decryption of received
   * messages.
   *
   * Strings must be in hex format.
   */
  deleteDecryptionKey(key: Uint8Array | string): void {
    this.decryptionKeys.delete(hexToBytes(key));
  }

  /**
   * Register an observer of new messages received via waku relay
   *
   * @param callback called when a new message is received via waku relay
   * @param contentTopics Content Topics for which the callback with be called,
   * all of them if undefined, [] or ["",..] is passed.
   * @returns {void}
   */
  addObserver(
    callback: (message: WakuMessage) => void,
    contentTopics: string[] = []
  ): void {
    if (contentTopics.length === 0) {
      if (!this.observers[""]) {
        this.observers[""] = new Set();
      }
      this.observers[""].add(callback);
    } else {
      contentTopics.forEach((contentTopic) => {
        if (!this.observers[contentTopic]) {
          this.observers[contentTopic] = new Set();
        }
        this.observers[contentTopic].add(callback);
      });
    }
  }

  /**
   * Remove an observer of new messages received via waku relay.
   * Useful to ensure the same observer is not registered several time
   * (e.g when loading React components)
   */
  deleteObserver(
    callback: (message: WakuMessage) => void,
    contentTopics: string[] = []
  ): void {
    if (contentTopics.length === 0) {
      if (this.observers[""]) {
        this.observers[""].delete(callback);
      }
    } else {
      contentTopics.forEach((contentTopic) => {
        if (this.observers[contentTopic]) {
          this.observers[contentTopic].delete(callback);
        }
      });
    }
  }

  /**
   * Subscribe to a pubsub topic and start emitting Waku messages to observers.
   *
   * @override
   */
  subscribe(pubSubTopic: string): void {
    this.addEventListener(
      "gossipsub:message",
      (event: CustomEvent<GossipsubMessage>) => {
        if (event.detail.msg.topic === pubSubTopic) {
          const decryptionParams = Array.from(this.decryptionKeys).map(
            ([key, { method, contentTopics }]) => {
              return {
                key,
                method,
                contentTopics,
              };
            }
          );

          dbg(`Message received on ${pubSubTopic}`);
          WakuMessage.decode(event.detail.msg.data, decryptionParams)
            .then((wakuMsg) => {
              if (!wakuMsg) {
                dbg("Failed to decode Waku Message");
                return;
              }

              if (this.observers[""]) {
                this.observers[""].forEach((callbackFn) => {
                  callbackFn(wakuMsg);
                });
              }
              if (wakuMsg.contentTopic) {
                if (this.observers[wakuMsg.contentTopic]) {
                  this.observers[wakuMsg.contentTopic].forEach((callbackFn) => {
                    callbackFn(wakuMsg);
                  });
                }
              }
            })
            .catch((e) => {
              dbg("Failed to decode Waku Message", e);
            });
        }
      }
    );

    super.subscribe(pubSubTopic);
  }

  getMeshPeers(topic?: TopicStr): PeerIdStr[] {
    return super.getMeshPeers(topic ?? this.pubSubTopic);
  }
}
