import concat from 'it-concat';
import lp from 'it-length-prefixed';
import pipe from 'it-pipe';
import Libp2p from 'libp2p';
import PeerId from 'peer-id';

import { WakuMessage } from '../waku_message';

import { HistoryRPC } from './history_rpc';

export const StoreCodec = '/vac/waku/store/2.0.0-beta3';

export class WakuStore {
  constructor(public libp2p: Libp2p) {}

  /**
   * Retrieve history from given peer
   * @param peerId
   * @param contentTopics
   * @param pubsubTopic
   * @throws if not able to reach peer
   */
  async queryHistory(
    peerId: PeerId,
    contentTopics?: string[],
    pubsubTopic?: string
  ): Promise<WakuMessage[] | null> {
    const peer = this.libp2p.peerStore.get(peerId);
    if (!peer) throw 'Peer is unknown';
    if (!peer.protocols.includes(StoreCodec))
      throw 'Peer does not register waku store protocol';
    const connection = this.libp2p.connectionManager.get(peer.id);
    if (!connection) throw 'Failed to get a connection to the peer';

    const messages: WakuMessage[] = [];
    let cursor = undefined;
    while (true) {
      try {
        const { stream } = await connection.newStream(StoreCodec);
        try {
          const historyRpcQuery = HistoryRPC.createQuery(
            contentTopics,
            cursor,
            pubsubTopic
          );
          const res = await pipe(
            [historyRpcQuery.encode()],
            lp.encode(),
            stream,
            lp.decode(),
            concat
          );
          try {
            const reply = HistoryRPC.decode(res.slice());

            const response = reply.response;
            if (!response) {
              console.log('No response in HistoryRPC');
              return null;
            }

            if (!response.messages || !response.messages.length) {
              // No messages left (or stored)
              console.log('No messages present in HistoryRPC response');
              return messages;
            }

            response.messages.map((protoMsg) => {
              messages.push(new WakuMessage(protoMsg));
            });

            const responsePageSize = response.pagingInfo?.pageSize;
            const queryPageSize = historyRpcQuery.query?.pagingInfo?.pageSize;
            if (
              responsePageSize &&
              queryPageSize &&
              responsePageSize < queryPageSize
            ) {
              // Response page size smaller than query, meaning this is the last page
              return messages;
            }

            cursor = response.pagingInfo?.cursor;
            if (cursor === undefined) {
              // If the server does not return cursor then there is an issue,
              // Need to abort or we end up in an infinite loop
              console.log('No cursor returned by peer.');
              return messages;
            }
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
    }
  }
}
