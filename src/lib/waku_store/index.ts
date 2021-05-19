import concat from 'it-concat';
import lp from 'it-length-prefixed';
import pipe from 'it-pipe';
import Libp2p from 'libp2p';
import PeerId from 'peer-id';

import { WakuMessage } from '../waku_message';
import { DefaultPubsubTopic } from '../waku_relay';

import { Direction, HistoryRPC } from './history_rpc';

export const StoreCodec = '/vac/waku/store/2.0.0-beta3';

export { Direction };

export interface Options {
  peerId: PeerId;
  contentTopics: string[];
  pubsubTopic?: string;
  direction?: Direction;
  pageSize?: number;
  callback?: (messages: WakuMessage[]) => void;
}

/**
 * Implements the [Waku v2 Store protocol](https://rfc.vac.dev/spec/13/).
 */
export class WakuStore {
  constructor(public libp2p: Libp2p) {}

  /**
   * Query given peer using Waku Store.
   *
   * @param options
   * @param options.peerId The peer to query.
   * @param options.contentTopics The content topics to retrieve, leave empty to
   * retrieve all messages.
   * @param options.pubsubTopic The pubsub topic to retrieve. Currently, all waku nodes
   * use the same pubsub topic. This is reserved for future applications.
   * @param options.callback Callback called on page of stored messages as they are retrieved
   * @throws If not able to reach the peer to query.
   */
  async queryHistory(options: Options): Promise<WakuMessage[] | null> {
    const opts = Object.assign(
      {
        pubsubTopic: DefaultPubsubTopic,
        direction: Direction.BACKWARD,
        pageSize: 10,
      },
      options
    );

    const peer = this.libp2p.peerStore.get(opts.peerId);
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
          const queryOpts = Object.assign(opts, { cursor });
          const historyRpcQuery = HistoryRPC.createQuery(queryOpts);
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

            const pageMessages = response.messages.map((protoMsg) => {
              return new WakuMessage(protoMsg);
            });

            if (opts.callback) {
              // TODO: Test the callback feature
              opts.callback(pageMessages);
            }

            pageMessages.forEach((wakuMessage) => {
              messages.push(wakuMessage);
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
