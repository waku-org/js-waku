import debug from "debug";
import Libp2p from "libp2p";
import Gossipsub from "libp2p-gossipsub";
import { AddrInfo, MessageIdFunction } from "libp2p-gossipsub/src/interfaces";
import { MessageCache } from "libp2p-gossipsub/src/message-cache";
import { RPC } from "libp2p-gossipsub/src/message/rpc";
import {
  PeerScoreParams,
  PeerScoreThresholds,
} from "libp2p-gossipsub/src/score";
import { createGossipRpc, shuffle } from "libp2p-gossipsub/src/utils";
import { InMessage } from "libp2p-interfaces/src/pubsub";
import { SignaturePolicy } from "libp2p-interfaces/src/pubsub/signature-policy";
import PeerId from "peer-id";

import { DefaultPubSubTopic } from "../constants";
import { hexToBytes } from "../utils";
import { CreateOptions } from "../waku";
import { DecryptionMethod, WakuMessage } from "../waku_message";

import * as constants from "./constants";
import { getRelayPeers } from "./get_relay_peers";
import { RelayHeartbeat } from "./relay_heartbeat";

const dbg = debug("waku:relay");

/**
 * See constructor libp2p-gossipsub [API](https://github.com/ChainSafe/js-libp2p-gossipsub#api).
 */
export interface GossipOptions {
  emitSelf: boolean;
  gossipIncoming: boolean;
  fallbackToFloodsub: boolean;
  floodPublish: boolean;
  doPX: boolean;
  msgIdFn: MessageIdFunction;
  messageCache: MessageCache;
  // This option is always overridden
  // globalSignaturePolicy: string;
  scoreParams: Partial<PeerScoreParams>;
  scoreThresholds: Partial<PeerScoreThresholds>;
  directPeers: AddrInfo[];
  D: number;
  Dlo: number;
  Dhi: number;
  Dscore: number;
  Dout: number;
  Dlazy: number;
}

/**
 * Implements the [Waku v2 Relay protocol]{@link https://rfc.vac.dev/spec/11/}.
 * Must be passed as a `pubsub` module to a {Libp2p} instance.
 *
 * @implements {require('libp2p-interfaces/src/pubsub')}
 * @noInheritDoc
 */
export class WakuRelay extends Gossipsub {
  heartbeat: RelayHeartbeat;
  pubSubTopic: string;

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

  constructor(
    libp2p: Libp2p,
    options?: Partial<CreateOptions & GossipOptions>
  ) {
    super(
      libp2p,
      Object.assign(options, {
        // Ensure that no signature is included nor expected in the messages.
        globalSignaturePolicy: SignaturePolicy.StrictNoSign,
      })
    );

    this.heartbeat = new RelayHeartbeat(this);
    this.observers = {};
    this.decryptionKeys = new Map();

    const multicodecs = constants.RelayCodecs;

    Object.assign(this, { multicodecs });

    this.pubSubTopic = options?.pubSubTopic || DefaultPubSubTopic;

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
    await super.publish(this.pubSubTopic, msg);
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
   * Return the relay peers we are connected to, and we would publish a message to
   */
  getPeers(): Set<string> {
    return getRelayPeers(this, this.pubSubTopic, this._options.D, (id) => {
      // Filter peers we would not publish to
      return (
        this.score.score(id) >= this._options.scoreThresholds.publishThreshold
      );
    });
  }

  /**
   * Subscribe to a pubsub topic and start emitting Waku messages to observers.
   *
   * @override
   */
  subscribe(pubSubTopic: string): void {
    this.on(pubSubTopic, (event) => {
      const decryptionKeys = Array.from(this.decryptionKeys).map(
        ([key, { method, contentTopics }]) => {
          return {
            key,
            method,
            contentTopics,
          };
        }
      );

      dbg(`Message received on ${pubSubTopic}`);
      WakuMessage.decode(event.data, decryptionKeys)
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
    });

    super.subscribe(pubSubTopic);
  }

  /**
   * Join pubsub topic.
   * This is present to override the behavior of Gossipsub and should not
   * be used by API Consumers
   *
   * @internal
   * @param {string} topic
   * @returns {void}
   * @override
   */
  join(topic: string): void {
    if (!this.started) {
      throw new Error("WakuRelayPubSub has not started");
    }

    const fanoutPeers = this.fanout.get(topic);
    if (fanoutPeers) {
      // these peers have a score above the publish threshold, which may be negative
      // so drop the ones with a negative score
      fanoutPeers.forEach((id) => {
        if (this.score.score(id) < 0) {
          fanoutPeers.delete(id);
        }
      });
      if (fanoutPeers.size < this._options.D) {
        // we need more peers; eager, as this would get fixed in the next heartbeat
        getRelayPeers(
          this,
          topic,
          this._options.D - fanoutPeers.size,
          (id: string): boolean => {
            // filter our current peers, direct peers, and peers with negative scores
            return (
              !fanoutPeers.has(id) &&
              !this.direct.has(id) &&
              this.score.score(id) >= 0
            );
          }
        ).forEach((id) => fanoutPeers.add(id));
      }
      this.mesh.set(topic, fanoutPeers);
      this.fanout.delete(topic);
      this.lastpub.delete(topic);
    } else {
      const peers = getRelayPeers(
        this,
        topic,
        this._options.D,
        (id: string): boolean => {
          // filter direct peers and peers with negative score
          return !this.direct.has(id) && this.score.score(id) >= 0;
        }
      );
      this.mesh.set(topic, peers);
    }
    this.mesh.get(topic)?.forEach((id) => {
      this.log("JOIN: Add mesh link to %s in %s", id, topic);
      this._sendGraft(id, topic);
    });
  }

  /**
   * Publish messages.
   * This is present to override the behavior of Gossipsub and should not
   * be used by API Consumers
   *
   * @ignore
   * @override
   * @param {InMessage} msg
   * @returns {void}
   */
  async _publish(msg: InMessage): Promise<void> {
    const msgIdStr = await this.getCanonicalMsgIdStr(msg);
    if (msg.receivedFrom !== this.peerId.toB58String()) {
      this.score.deliverMessage(msg, msgIdStr);
      this.gossipTracer.deliverMessage(msgIdStr);
    }

    // put in seen cache
    this.seenCache.put(msgIdStr);

    this.messageCache.put(msg, msgIdStr);

    const toSend = new Set<string>();
    msg.topicIDs.forEach((topic) => {
      const peersInTopic = this.topics.get(topic);
      if (!peersInTopic) {
        return;
      }

      // direct peers
      this.direct.forEach((id) => {
        toSend.add(id);
      });

      let meshPeers = this.mesh.get(topic);
      if (!meshPeers || !meshPeers.size) {
        // We are not in the mesh for topic, use fanout peers
        meshPeers = this.fanout.get(topic);
        if (!meshPeers) {
          // If we are not in the fanout, then pick peers in topic above the publishThreshold
          const peers = getRelayPeers(this, topic, this._options.D, (id) => {
            return (
              this.score.score(id) >=
              this._options.scoreThresholds.publishThreshold
            );
          });

          if (peers.size > 0) {
            meshPeers = peers;
            this.fanout.set(topic, peers);
          } else {
            meshPeers = new Set();
          }
        }
        // Store the latest publishing time
        this.lastpub.set(topic, this._now());
      }

      meshPeers?.forEach((peer) => {
        toSend.add(peer);
      });
    });
    // Publish messages to peers
    const rpc = createGossipRpc([Gossipsub.utils.normalizeOutRpcMessage(msg)]);
    dbg(`Relay message to ${toSend.size} peers`);
    toSend.forEach((id) => {
      if (id === msg.from) {
        return;
      }
      dbg("Relay message to", id);
      this._sendRpc(id, rpc);
    });
  }

  /**
   * Emits gossip to peers in a particular topic.
   *
   * This is present to override the behavior of Gossipsub and should not
   * be used by API Consumers
   *
   * @ignore
   * @override
   * @param {string} topic
   * @param {Set<string>} exclude peers to exclude
   * @returns {void}
   */
  _emitGossip(topic: string, exclude: Set<string>): void {
    const messageIDs = this.messageCache.getGossipIDs(topic);
    if (!messageIDs.length) {
      return;
    }

    // shuffle to emit in random order
    shuffle(messageIDs);

    // if we are emitting more than GossipsubMaxIHaveLength ids, truncate the list
    if (messageIDs.length > constants.RelayMaxIHaveLength) {
      // we do the truncation (with shuffling) per peer below
      this.log(
        "too many messages for gossip; will truncate IHAVE list (%d messages)",
        messageIDs.length
      );
    }

    // Send gossip to GossipFactor peers above threshold with a minimum of D_lazy
    // First we collect the peers above gossipThreshold that are not in the exclude set
    // and then randomly select from that set
    // We also exclude direct peers, as there is no reason to emit gossip to them
    const peersToGossip: string[] = [];
    const topicPeers = this.topics.get(topic);
    if (!topicPeers) {
      // no topic peers, no gossip
      return;
    }
    topicPeers.forEach((id) => {
      const peerStreams = this.peers.get(id);
      if (!peerStreams) {
        return;
      }
      if (
        !exclude.has(id) &&
        !this.direct.has(id) &&
        constants.RelayCodecs.includes(peerStreams.protocol) &&
        this.score.score(id) >= this._options.scoreThresholds.gossipThreshold
      ) {
        peersToGossip.push(id);
      }
    });

    let target = this._options.Dlazy;
    const factor = constants.RelayGossipFactor * peersToGossip.length;
    if (factor > target) {
      target = factor;
    }
    if (target > peersToGossip.length) {
      target = peersToGossip.length;
    } else {
      shuffle(peersToGossip);
    }
    // Emit the IHAVE gossip to the selected peers up to the target
    peersToGossip.slice(0, target).forEach((id) => {
      let peerMessageIDs = messageIDs;
      if (messageIDs.length > constants.RelayMaxIHaveLength) {
        // shuffle and slice message IDs per peer so that we emit a different set for each peer
        // we have enough redundancy in the system that this will significantly increase the message
        // coverage when we do truncate
        peerMessageIDs = shuffle(peerMessageIDs.slice()).slice(
          0,
          constants.RelayMaxIHaveLength
        );
      }
      this._pushGossip(id, {
        topicID: topic,
        messageIDs: peerMessageIDs,
      });
    });
  }

  /**
   * Make a PRUNE control message for a peer in a topic.
   * This is present to override the behavior of Gossipsub and should not
   * be used by API Consumers
   *
   * @ignore
   * @override
   * @param {string} id
   * @param {string} topic
   * @param {boolean} doPX
   * @returns {Promise<RPC.IControlPrune>}
   */
  async _makePrune(
    id: string,
    topic: string,
    doPX: boolean
  ): Promise<RPC.IControlPrune> {
    // backoff is measured in seconds
    // RelayPruneBackoff is measured in milliseconds
    const backoff = constants.RelayPruneBackoff / 1000;
    if (!doPX) {
      return {
        topicID: topic,
        peers: [],
        backoff: backoff,
      };
    }

    // select peers for Peer eXchange
    const peers = getRelayPeers(
      this,
      topic,
      constants.RelayPrunePeers,
      (xid: string): boolean => {
        return xid !== id && this.score.score(xid) >= 0;
      }
    );
    const px = await Promise.all(
      Array.from(peers).map(async (p) => {
        // see if we have a signed record to send back; if we don't, just send
        // the peer ID and let the pruned peer find them in the DHT -- we can't trust
        // unsigned address records through PX anyways
        // Finding signed records in the DHT is not supported at the time of writing in js-libp2p
        const peerId = PeerId.createFromB58String(p);
        return {
          peerID: peerId.toBytes(),
          signedPeerRecord:
            await this._libp2p.peerStore.addressBook.getRawEnvelope(peerId),
        };
      })
    );
    return {
      topicID: topic,
      peers: px,
      backoff: backoff,
    };
  }
}
