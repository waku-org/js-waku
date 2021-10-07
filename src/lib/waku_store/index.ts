import debug from 'debug';
import concat from 'it-concat';
import lp from 'it-length-prefixed';
import pipe from 'it-pipe';
import Libp2p from 'libp2p';
import { Peer } from 'libp2p/src/peer-store';
import PeerId from 'peer-id';

import { HistoryResponse_Error } from '../../proto/waku/v2/store';
import { getPeersForProtocol, selectRandomPeer } from '../select_peer';
import { hexToBuf } from '../utils';
import { DefaultPubSubTopic } from '../waku';
import { WakuMessage } from '../waku_message';

import { HistoryRPC, PageDirection } from './history_rpc';

const dbg = debug('waku:store');

export const StoreCodec = '/vac/waku/store/2.0.0-beta3';

export const DefaultPageSize = 10;

export { PageDirection };

export interface CreateOptions {
  /**
   * The PubSub Topic to use. Defaults to {@link DefaultPubSubTopic}.
   *
   * The usage of the default pubsub topic is recommended.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for details.
   *
   * @default {@link DefaultPubSubTopic}
   */
  pubSubTopic?: string;
}

export interface TimeFilter {
  startTime: Date;
  endTime: Date;
}

export interface QueryOptions {
  /**
   * The peer to query. If undefined, a pseudo-random peer is selected from the connected Waku Store peers.
   */
  peerId?: PeerId;
  /**
   * The pubsub topic to pass to the query.
   * See [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/).
   */
  pubSubTopic?: string;
  /**
   * The direction in which pages are retrieved:
   * - [[Direction.BACKWARD]]: Most recent page first.
   * - [[Direction.FORWARD]]: Oldest page first.
   *
   * Note: This does not affect the ordering of messages with the page
   * (oldest message is always first).
   *
   * @default [[Direction.BACKWARD]]
   */
  pageDirection?: PageDirection;
  /**
   * The number of message per page.
   *
   * @default [[DefaultPageSize]]
   */
  pageSize?: number;
  /**
   * Retrieve messages with a timestamp within the provided values.
   */
  timeFilter?: TimeFilter;
  /**
   * Callback called on pages of stored messages as they are retrieved.
   *
   * Allows for a faster access to the results as it is called as soon as a page
   * is received. Traversal of the pages is done automatically so this function
   * will invoked for each retrieved page.
   *
   * If the call on a page returns `true`, then traversal of the pages is aborted.
   * For example, this can be used for the caller to stop the query after a
   * specific message is found.
   */
  callback?: (messages: WakuMessage[]) => void | boolean;
  /**
   * Keys that will be used to decrypt messages.
   *
   * It can be Asymmetric Private Keys and Symmetric Keys in the same array,
   * all keys will be tried with both methods.
   */
  decryptionKeys?: Array<Uint8Array | string>;
}

/**
 * Implements the [Waku v2 Store protocol](https://rfc.vac.dev/spec/13/).
 */
export class WakuStore {
  pubSubTopic: string;
  public decryptionKeys: Set<Uint8Array>;

  constructor(public libp2p: Libp2p, options?: CreateOptions) {
    if (options?.pubSubTopic) {
      this.pubSubTopic = options.pubSubTopic;
    } else {
      this.pubSubTopic = DefaultPubSubTopic;
    }

    this.decryptionKeys = new Set();
  }

  /**
   * Do a History Query to a Waku Store.
   *
   * @param contentTopics The content topics to pass to the query, leave empty to
   * retrieve all messages.
   *
   * @throws If not able to reach a Waku Store peer to query
   * or if an error is encountered when processing the reply.
   */
  async queryHistory(
    contentTopics: string[],
    options?: QueryOptions
  ): Promise<WakuMessage[]> {
    let startTime, endTime;
    if (options?.timeFilter) {
      startTime = options.timeFilter.startTime.getTime() / 1000;
      endTime = options.timeFilter.endTime.getTime() / 1000;
    }

    const opts = Object.assign(
      {
        pubSubTopic: this.pubSubTopic,
        pageDirection: PageDirection.BACKWARD,
        pageSize: DefaultPageSize,
      },
      options,
      {
        startTime,
        endTime,
      },
      { contentTopics }
    );
    dbg('Querying history with the following options', options);

    let peer;
    if (opts.peerId) {
      peer = this.libp2p.peerStore.get(opts.peerId);
      if (!peer)
        throw `Failed to retrieve connection details for provided peer in peer store: ${opts.peerId.toB58String()}`;
    } else {
      peer = this.randomPeer;
      if (!peer)
        throw 'Failed to find known peer that registers waku store protocol';
    }
    if (!peer.protocols.includes(StoreCodec))
      throw `Peer does not register waku store protocol: ${peer.id.toB58String()}`;
    const connection = this.libp2p.connectionManager.get(peer.id);
    if (!connection) throw 'Failed to get a connection to the peer';

    const decryptionKeys = Array.from(this.decryptionKeys.values());
    if (opts.decryptionKeys) {
      opts.decryptionKeys.forEach((key) => {
        decryptionKeys.push(hexToBuf(key));
      });
    }

    const messages: WakuMessage[] = [];
    let cursor = undefined;
    while (true) {
      const { stream } = await connection.newStream(StoreCodec);
      const queryOpts = Object.assign(opts, { cursor });
      const historyRpcQuery = HistoryRPC.createQuery(queryOpts);
      dbg('Querying store peer', connection.remoteAddr.toString());

      const res = await pipe(
        [historyRpcQuery.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        concat
      );
      const reply = HistoryRPC.decode(res.slice());

      const response = reply.response;
      if (!response) {
        throw 'History response misses response field';
      }

      if (
        response.error &&
        response.error === HistoryResponse_Error.ERROR_INVALID_CURSOR
      ) {
        throw 'History response contains an Error: INVALID CURSOR';
      }

      if (!response.messages || !response.messages.length) {
        // No messages left (or stored)
        console.log('No messages present in HistoryRPC response');
        return messages;
      }

      dbg(
        `${response.messages.length} messages retrieved for pubsub topic ${opts.pubSubTopic}`
      );

      const pageMessages: WakuMessage[] = [];
      await Promise.all(
        response.messages.map(async (protoMsg) => {
          const msg = await WakuMessage.decodeProto(protoMsg, decryptionKeys);

          if (msg) {
            messages.push(msg);
            pageMessages.push(msg);
          }
        })
      );

      let abort = false;
      if (opts.callback) {
        abort = Boolean(opts.callback(pageMessages));
      }

      const responsePageSize = response.pagingInfo?.pageSize;
      const queryPageSize = historyRpcQuery.query?.pagingInfo?.pageSize;
      if (
        abort ||
        // Response page size smaller than query, meaning this is the last page
        (responsePageSize && queryPageSize && responsePageSize < queryPageSize)
      ) {
        return messages;
      }

      cursor = response.pagingInfo?.cursor;
      if (cursor === undefined) {
        // If the server does not return cursor then there is an issue,
        // Need to abort or we end up in an infinite loop
        console.log('No cursor returned by peer.');
        return messages;
      }
    }
  }

  /**
   * Register a decryption key to attempt decryption of messages received in any
   * subsequent [[queryHistory]] call. This can either be a private key for
   * asymmetric encryption or a symmetric key. [[WakuStore]] will attempt to
   * decrypt messages using both methods.
   *
   * Strings must be in hex format.
   */
  addDecryptionKey(key: Uint8Array | string): void {
    this.decryptionKeys.add(hexToBuf(key));
  }

  /**
   * Delete a decryption key that was used to attempt decryption of messages
   * received in subsequent [[queryHistory]] calls.
   *
   * Strings must be in hex format.
   */
  deleteDecryptionKey(key: Uint8Array | string): void {
    this.decryptionKeys.delete(hexToBuf(key));
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
