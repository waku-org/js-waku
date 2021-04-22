import Gossipsub from 'libp2p-gossipsub';
import {
  AddrInfo,
  Libp2p,
  MessageIdFunction,
} from 'libp2p-gossipsub/src/interfaces';
import { ControlPrune, PeerInfo } from 'libp2p-gossipsub/src/message';
import { MessageCache } from 'libp2p-gossipsub/src/message-cache';
import {
  PeerScoreParams,
  PeerScoreThresholds,
} from 'libp2p-gossipsub/src/score';
import {
  createGossipRpc,
  messageIdToString,
  shuffle,
} from 'libp2p-gossipsub/src/utils';
import { InMessage } from 'libp2p-interfaces/src/pubsub';
import { SignaturePolicy } from 'libp2p-interfaces/src/pubsub/signature-policy';
import PeerId from 'peer-id';

import { WakuMessage } from '../waku_message';

import * as constants from './constants';
import { getRelayPeers } from './get_relay_peers';
import { RelayHeartbeat } from './relay_heartbeat';

export * from './constants';
export * from './relay_heartbeat';

/**
 * See GossipOptions from libp2p-gossipsub
 */
interface GossipOptions {
  emitSelf: boolean;
  gossipIncoming: boolean;
  fallbackToFloodsub: boolean;
  floodPublish: boolean;
  doPX: boolean;
  msgIdFn: MessageIdFunction;
  messageCache: MessageCache;
  globalSignaturePolicy: string;
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

export class WakuRelay extends Gossipsub {
  heartbeat: RelayHeartbeat;

  /**
   *
   * @param {Libp2p} libp2p
   * @param {Partial<GossipOptions>} [options]
   */
  constructor(libp2p: Libp2p, options?: Partial<GossipOptions>) {
    super(
      libp2p,
      Object.assign(options, {
        // Ensure that no signature is included nor expected in the messages.
        globalSignaturePolicy: SignaturePolicy.StrictNoSign,
      })
    );

    this.heartbeat = new RelayHeartbeat(this);

    const multicodecs = [constants.RelayCodec];

    Object.assign(this, { multicodecs });
  }

  /**
   * Mounts the gossipsub protocol onto the libp2p node
   * and subscribes to the default topic
   * @override
   * @returns {void}
   */
  start() {
    super.start();
    super.subscribe(constants.RelayDefaultTopic);
  }

  /**
   * Send Waku messages under default topic
   * @override
   * @param {WakuMessage} message
   * @returns {Promise<void>}
   */
  async send(message: WakuMessage) {
    const msg = message.toBinary();
    await super.publish(constants.RelayDefaultTopic, Buffer.from(msg));
  }

  /**
   * Join topic
   * @param {string} topic
   * @returns {void}
   * @override
   */
  join(topic: string): void {
    if (!this.started) {
      throw new Error('WakuRelayPubsub has not started');
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
      this.log('JOIN: Add mesh link to %s in %s', id, topic);
      this._sendGraft(id, topic);
    });
  }

  /**
   * Publish messages
   *
   * @override
   * @param {InMessage} msg
   * @returns {void}
   */
  async _publish(msg: InMessage): Promise<void> {
    if (msg.receivedFrom !== this.peerId.toB58String()) {
      this.score.deliverMessage(msg);
      this.gossipTracer.deliverMessage(msg);
    }

    const msgID = this.getMsgId(msg);
    const msgIdStr = messageIdToString(msgID);
    // put in seen cache
    this.seenCache.put(msgIdStr);

    this.messageCache.put(msg);

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
    toSend.forEach((id) => {
      if (id === msg.from) {
        return;
      }
      this._sendRpc(id, rpc);
    });
  }

  /**
   * Emits gossip to peers in a particular topic
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
        'too many messages for gossip; will truncate IHAVE list (%d messages)',
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
        peerStreams.protocol == constants.RelayCodec &&
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
   * Make a PRUNE control message for a peer in a topic
   * @param {string} id
   * @param {string} topic
   * @param {boolean} doPX
   * @returns {ControlPrune}
   */
  _makePrune(id: string, topic: string, doPX: boolean): ControlPrune {
    // backoff is measured in seconds
    // RelayPruneBackoff is measured in milliseconds
    const backoff = constants.RelayPruneBackoff / 1000;
    const px: PeerInfo[] = [];
    if (doPX) {
      // select peers for Peer eXchange
      const peers = getRelayPeers(
        this,
        topic,
        constants.RelayPrunePeers,
        (xid: string): boolean => {
          return xid !== id && this.score.score(xid) >= 0;
        }
      );
      peers.forEach((p) => {
        // see if we have a signed record to send back; if we don't, just send
        // the peer ID and let the pruned peer find them in the DHT -- we can't trust
        // unsigned address records through PX anyways
        // Finding signed records in the DHT is not supported at the time of writing in js-libp2p
        const peerId = PeerId.createFromB58String(p);
        px.push({
          peerID: peerId.toBytes(),
          signedPeerRecord: this._libp2p.peerStore.addressBook.getRawEnvelope(
            peerId
          ),
        });
      });
    }
    return {
      topicID: topic,
      peers: px,
      backoff: backoff,
    };
  }
}
