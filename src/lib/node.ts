import Libp2p from 'libp2p';
import Mplex from 'libp2p-mplex';
import { NOISE } from 'libp2p-noise';
import TCP from 'libp2p-tcp';

import { WakuRelayPubsub } from './waku_relay';

export async function createNode() {
  const node = await Libp2p.create({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0'],
    },
    modules: {
      transport: [TCP],
      streamMuxer: [Mplex],
      connEncryption: [NOISE],
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Type needs update
      pubsub: WakuRelayPubsub,
    },
    config: {
      pubsub: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        enabled: true,
        emitSelf: true,
        signMessages: false,
        strictSigning: false,
        // Ensure that no signature is expected in the messages.
        globalSignaturePolicy: 'StrictNoSign',
      },
    },
  });

  await node.start();
  return node;
}
