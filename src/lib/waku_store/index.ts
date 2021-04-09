import concat from 'it-concat';
import lp from 'it-length-prefixed';
import pipe from 'it-pipe';
import Libp2p from 'libp2p';
import PeerId from 'peer-id';

import { HistoryRPC } from './history_rpc';

export const StoreCodec = '/vac/waku/store/2.0.0-beta1';

export class WakuStore {
  constructor(public libp2p: Libp2p) {}

  /**
   * Retrieve history from given peer
   * @param peerId
   * @param topics
   * @throws if not able to reach peer
   */
  async queryHistory(peerId: PeerId, topics?: string[]) {
    const peer = this.libp2p.peerStore.get(peerId);
    if (!peer) throw 'Peer is unknown';
    if (!peer.protocols.includes(StoreCodec))
      throw 'Peer does not register waku store protocol';
    const connection = this.libp2p.connectionManager.get(peer.id);
    if (!connection) throw 'Failed to get a connection to the peer';

    try {
      const { stream } = await connection.newStream(StoreCodec);

      const historyRpc = HistoryRPC.query(topics).encode();
      try {
        const res = await pipe(
          [historyRpc],
          lp.encode(),
          stream,
          lp.decode(),
          concat
        );
        const buf = res.slice();
        try {
          const reply = HistoryRPC.decode(buf);
          return reply.response;
        } catch (err) {
          console.log('Failed to decode store reply', err);
        }
      } catch (err) {
        console.log('Failed to send waku store query', err);
      }
    } catch (err) {
      console.log(
        'Failed to negotiate waku store protocol stream with peer',
        err
      );
    }
    return null;
  }
}
