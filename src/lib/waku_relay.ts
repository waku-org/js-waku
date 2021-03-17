import Gossipsub from 'libp2p-gossipsub';
import { Libp2p } from 'libp2p-gossipsub/src/interfaces';
import Pubsub from 'libp2p-interfaces/src/pubsub';
import { SignaturePolicy } from 'libp2p-interfaces/src/pubsub/signature-policy';

import { Message } from './waku_message';

export const CODEC = '/vac/waku/relay/2.0.0-beta2';

// As per waku specs, the topic is fixed, value taken from nim-waku
export const TOPIC = '/waku/2/default-waku/proto';

// This is the class to pass to libp2p as pubsub protocol
export class WakuRelayPubsub extends Gossipsub {
  /**
   *
   * @param libp2p: Libp2p
   * @param options: Partial<GossipInputOptions>
   */
  constructor(libp2p: Libp2p) {
    super(libp2p, {
      emitSelf: true,
      // Ensure that no signature is expected in the messages.
      globalSignaturePolicy: SignaturePolicy.StrictNoSign,
    });

    const multicodecs = [CODEC];

    // This is the downside of using `libp2p-gossipsub` instead of
    // implementing WakuRelay from scratch.
    Object.assign(this, { multicodecs });
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

  async publish(message: Message) {
    const msg = message.toBinary();
    await this.pubsub.publish(TOPIC, msg);
  }
}
