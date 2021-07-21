import debug from 'debug';
import concat from 'it-concat';
import lp from 'it-length-prefixed';
import pipe from 'it-pipe';
import Libp2p from 'libp2p';
import { Peer } from 'libp2p/src/peer-store';
import PeerId from 'peer-id';

import { getPeersForProtocol, selectRandomPeer } from '../select_peer';
import { WakuMessage } from '../waku_message';
import { DefaultPubsubTopic } from '../waku_relay';

import { Direction, HistoryRPC } from './history_rpc';

const dbg = debug('waku:store');

export const StoreCodec = '/vac/waku/store/2.0.0-beta3';

export { Direction };

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

export interface QueryOptions {
  peerId?: PeerId;
  contentTopics: string[];
  pubsubTopic?: string;
  direction?: Direction;
  pageSize?: number;
  callback?: (messages: WakuMessage[]) => void;
  decryptionKeys?: Uint8Array[];
}

/**
 * Implements the [Waku v2 Store protocol](https://rfc.vac.dev/spec/13/).
 */
export class WakuStore {
  pubsubTopic: string;

  constructor(public libp2p: Libp2p, options?: CreateOptions) {
    if (options?.pubsubTopic) {
      this.pubsubTopic = options.pubsubTopic;
    } else {
      this.pubsubTopic = DefaultPubsubTopic;
    }
  }

  /**
   * Query given peer using Waku Store.
   *
   * @param options
   * @param options.peerId The peer to query.Options
   * @param options.contentTopics The content topics to pass to the query, leave empty to
   * retrieve all messages.
   * @param options.pubsubTopic The pubsub topic to pass to the query. Defaults
   * to the value set at creation. See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/).
   * @param options.callback Callback called on page of stored messages as they are retrieved
   * @param options.decryptionKeys Keys that will be used to decrypt messages.
   * It can be Asymmetric Private Keys and Symmetric Keys in the same array, all keys will be tried with both
   * methods.
   * @throws If not able to reach the peer to query.
   */
  async queryHistory(options: QueryOptions): Promise<WakuMessage[] | null> {
    const opts = Object.assign(
      {
        pubsubTopic: this.pubsubTopic,
        direction: Direction.BACKWARD,
        pageSize: 10,
      },
      options
    );
    dbg('Querying history with the following options', options);

    let peer;
    if (opts.peerId) {
      peer = this.libp2p.peerStore.get(opts.peerId);
      if (!peer) throw 'Peer is unknown';
    } else {
      peer = this.randomPeer;
    }
    if (!peer) throw 'No peer available';
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

            dbg(
              `${response.messages.length} messages retrieved for pubsub topic ${opts.pubsubTopic}`
            );

            const pageMessages: WakuMessage[] = [];
            await Promise.all(
              response.messages.map(async (protoMsg) => {
                const msg = await WakuMessage.decodeProto(
                  protoMsg,
                  opts.decryptionKeys
                );

                if (msg) {
                  messages.push(msg);
                  pageMessages.push(msg);
                }
              })
            );

            if (opts.callback) {
              // TODO: Test the callback feature
              // TODO: Change callback to take individual messages
              opts.callback(pageMessages);
            }

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
            return null;
          }
        } catch (err) {
          console.log('Failed to send waku store query', err);
          return null;
        }
      } catch (err) {
        console.log(
          'Failed to negotiate waku store protocol stream with peer',
          err
        );
        return null;
      }
    }
  }

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * store protocol. Waku may or  may not be currently connected to these peers.
   */
  get peers(): Peer[] {
    return getPeersForProtocol(this.libp2p, StoreCodec);
  }

  /**
   * Returns a random peer that supports store protocol from the address
   * book (`libp2p.peerStore`). Waku may or  may not be currently connected to
   * this peer.
   */
  get randomPeer(): Peer | undefined {
    return selectRandomPeer(this.peers);
  }
}
