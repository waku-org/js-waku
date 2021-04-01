import Gossipsub from 'libp2p-gossipsub';
import { Libp2p } from 'libp2p-gossipsub/src/interfaces';
import { createGossipRpc, messageIdToString } from 'libp2p-gossipsub/src/utils';
import Pubsub, { InMessage } from 'libp2p-interfaces/src/pubsub';
import { SignaturePolicy } from 'libp2p-interfaces/src/pubsub/signature-policy';

import { WakuMessage } from '../waku_message';

import { RelayCodec, RelayDefaultTopic } from './constants';
import { getWakuPeers } from './get_waku_peers';
import { RelayHeartbeat } from './relay_heartbeat';

export * from './constants';
export * from './relay_heartbeat';

// This is the class to pass to libp2p as pubsub protocol
export class WakuRelayPubsub extends Gossipsub {
  heartbeat: RelayHeartbeat;

  /**
   *
   * @param libp2p: Libp2p
   */
  constructor(libp2p: Libp2p) {
    super(libp2p, {
      emitSelf: false,
      // Ensure that no signature is expected in the messages.
      globalSignaturePolicy: SignaturePolicy.StrictNoSign,
    });

    this.heartbeat = new RelayHeartbeat(this);

    const multicodecs = [RelayCodec];

    // This is the downside of using `libp2p-gossipsub` instead of
    // implementing WakuRelay from scratch.
    Object.assign(this, { multicodecs });
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
        getWakuPeers(
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
      const peers = getWakuPeers(
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
    this.mesh.get(topic)!.forEach((id) => {
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
          const peers = getWakuPeers(this, topic, this._options.D, (id) => {
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

      meshPeers!.forEach((peer) => {
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
}

// This class provides an interface to execute the waku relay protocol
export class WakuRelay {
  constructor(private pubsub: Pubsub) {}

  // At this stage we are always using the same topic so we do not pass it as a parameter
  async subscribe() {
    await this.pubsub.subscribe(RelayDefaultTopic);
  }

  async publish(message: WakuMessage) {
    const msg = message.toBinary();
    await this.pubsub.publish(RelayDefaultTopic, msg);
  }
}
