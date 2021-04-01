import Gossipsub from 'libp2p-gossipsub';
import { Libp2p } from 'libp2p-gossipsub/src/interfaces';
import Pubsub from 'libp2p-interfaces/src/pubsub';
import { SignaturePolicy } from 'libp2p-interfaces/src/pubsub/signature-policy';

import { getWakuPeers } from './get_waku_peers';
import { WakuMessage } from './waku_message';

export const CODEC = '/vac/waku/relay/2.0.0-beta2';

// As per waku specs, the topic is fixed, value taken from nim-waku
export const TOPIC = '/waku/2/default-waku/proto';

// This is the class to pass to libp2p as pubsub protocol
export class WakuRelayPubsub extends Gossipsub {
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

    const multicodecs = [CODEC];

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
}

// TODO: Implement dial for an address with format '/ip4/127.0.0.1/tcp/60000/p2p/16Uiu2HAkyzsXzENw5XBDYEQQAeQTCYjBJpMLgBmEXuwbtcrgxBJ4'
// This class provides an interface to execute the waku relay protocol
export class WakuRelay {
  constructor(private pubsub: Pubsub) {}

  // At this stage we are always using the same topic so we do not pass it as a parameter
  async subscribe() {
    await this.pubsub.subscribe(TOPIC);
  }

  async publish(message: WakuMessage) {
    const msg = message.toBinary();
    await this.pubsub.publish(TOPIC, msg);
  }
}
