import Libp2p from 'libp2p';
import Mplex from 'libp2p-mplex';
import { NOISE } from 'libp2p-noise';
import Secio from 'libp2p-secio';
import TCP from 'libp2p-tcp';
import Multiaddr from 'multiaddr';
import multiaddr from 'multiaddr';

import { CODEC, WakuRelay } from './lib/waku_relay';

(async () => {
  // Handle arguments
  const { peer } = args();

  const libp2p = await Libp2p.create({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/0', '/ip4/0.0.0.0/tcp/0/ws'],
    },
    modules: {
      transport: [TCP],
      streamMuxer: [Mplex],
      connEncryption: [NOISE, Secio],
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: Key missing, see https://github.com/libp2p/js-libp2p/issues/830#issuecomment-791040021
      pubsub: WakuRelay,
    },
    config: {
      pubsub: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        enabled: true,
        emitSelf: true,
        signMessages: false,
        strictSigning: false,
      },
    },
  });

  libp2p.connectionManager.on('peer:connect', (connection) => {
    console.info(`Connected to ${connection.remotePeer.toB58String()}!`);
  });

  // Start libp2p
  await libp2p.start();

  console.log('listening on addresses:');
  libp2p.multiaddrs.forEach((addr) => {
    console.log(`${addr.toString()}/p2p/${libp2p.peerId.toB58String()}`);
  });

  console.log('\nNode supports protocols:');
  libp2p.upgrader.protocols.forEach((_, p) => console.log(p));

  // Dial nim-waku using waku relay protocol
  if (process.argv.length >= 3) {
    console.log(`dialing remote peer at ${peer}`);
    await libp2p.dialProtocol(peer, CODEC);
    console.log(`dialed ${peer}`);
  }
})();

function args(): { peer: Multiaddr } {
  const args = process.argv.slice(2);

  if (args.length != 1) {
    console.log(`Usage:
  ${process.argv[0]} ${process.argv[1]} <peer multiaddress>`);
    process.exit(1);
  }

  const peer = multiaddr(args[0]);

  return { peer };
}
