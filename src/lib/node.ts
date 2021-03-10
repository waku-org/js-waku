import Libp2p from 'libp2p';
import Gossipsub from 'libp2p-gossipsub';
import Mplex from 'libp2p-mplex';
import { NOISE } from 'libp2p-noise';
import TCP from 'libp2p-tcp';

export const createNode = async () => {
    const node = await Libp2p.create({
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0']
      },
      modules: {
        transport: [TCP],
        streamMuxer: [Mplex],
        connEncryption: [NOISE],
        // @ts-ignore: Type needs update
        pubsub: Gossipsub
      }
    })

    await node.start()
    return node
  }
