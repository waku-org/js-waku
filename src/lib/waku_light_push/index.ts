import concat from 'it-concat';
import lp from 'it-length-prefixed';
import pipe from 'it-pipe';
import Libp2p from 'libp2p';
import PeerId from 'peer-id';

import { PushResponse } from '../../proto/waku/v2/light_push';
import { selectRandomPeer } from '../select_peer';
import { WakuMessage } from '../waku_message';
import { DefaultPubsubTopic } from '../waku_relay';

import { PushRPC } from './push_rpc';

export const LightPushCodec = '/vac/waku/lightpush/2.0.0-beta1';
export { PushResponse };

export interface CreateOptions {
  /**
   * The PubSub Topic to use. Defaults to {@link DefaultPubsubTopic}.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   * @default {@link DefaultPubsubTopic}
   */
  pubsubTopic?: string;
}

export interface PushOptions {
  peerId?: PeerId;
  pubsubTopic?: string;
}

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
export class WakuLightPush {
  pubsubTopic: string;

  constructor(public libp2p: Libp2p, options?: CreateOptions) {
    if (options?.pubsubTopic) {
      this.pubsubTopic = options.pubsubTopic;
    } else {
      this.pubsubTopic = DefaultPubsubTopic;
    }
  }

  async push(
    message: WakuMessage,
    opts?: PushOptions
  ): Promise<PushResponse | null> {
    let peer;
    if (opts?.peerId) {
      peer = this.libp2p.peerStore.get(opts.peerId);
      if (!peer) throw 'Peer is unknown';
    } else {
      peer = selectRandomPeer(this.libp2p, LightPushCodec);
    }
    if (!peer) throw 'No peer available';
    if (!peer.protocols.includes(LightPushCodec))
      throw 'Peer does not register waku light push protocol';

    const connection = this.libp2p.connectionManager.get(peer.id);
    if (!connection) throw 'Failed to get a connection to the peer';

    const { stream } = await connection.newStream(LightPushCodec);
    try {
      const pubsubTopic = opts?.pubsubTopic
        ? opts.pubsubTopic
        : this.pubsubTopic;
      const query = PushRPC.createRequest(message, pubsubTopic);
      const res = await pipe(
        [query.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        concat
      );
      try {
        const response = PushRPC.decode(res.slice()).response;

        if (!response) {
          console.log('No response in PushRPC');
          return null;
        }

        return response;
      } catch (err) {
        console.log('Failed to decode push reply', err);
      }
    } catch (err) {
      console.log('Failed to send waku light push request', err);
    }
    return null;
  }
}
