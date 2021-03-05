import Libp2p from 'libp2p';
import Gossipsub from 'libp2p-gossipsub';

export const CODEC = '/vac/waku/relay/2.0.0-beta2';

export class WakuRelay extends Gossipsub {
  constructor(libp2p: Libp2p) {
    super(libp2p);

    const multicodecs = [CODEC];

    // This is the downside of using `libp2p-gossipsub` instead of `libp2p-interfaces/src/pubsub`
    Object.assign(this, { multicodecs });
  }
}
