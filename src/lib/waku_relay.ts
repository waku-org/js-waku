import { TextEncoder } from 'util';

import Libp2p from 'libp2p';
import Gossipsub from 'libp2p-gossipsub';

export const CODEC = '/vac/waku/relay/2.0.0-beta2';

// // As per waku specs, the topic is fixed
// // TODO: Double check the topic is correct (taken from nim-waku logs)
export const TOPIC = '/waku/2/default-waku/proto';

// This is the class to pass to libp2p as pubsub protocol
export class WakuRelayPubsub extends Gossipsub {
  constructor(libp2p: Libp2p) {
    super(libp2p);

    const multicodecs = [CODEC];

    // This is the downside of using `libp2p-gossipsub` instead of `libp2p-interfaces/src/pubsub`
    Object.assign(this, { multicodecs });
  }
}

// This class provides an interface to execute the waku relay protocol
export class WakuRelay {
  constructor(private pubsub: WakuRelayPubsub) {}

  // At this stage we are always using the same topic so we do not pass it as a parameter
  async subscribe() {
    await this.pubsub.subscribe(TOPIC);
  }

  async publish(message: string) {
    const msg = new TextEncoder().encode(message);
    await this.pubsub.publish(TOPIC, msg);
  }
}
