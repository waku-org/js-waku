import debug from "debug";
import concat from "it-concat";
import lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import Libp2p from "libp2p";
import { Peer } from "libp2p/src/peer-store";
import PeerId from "peer-id";

import { DefaultPubSubTopic, StoreCodecs } from "../constants";
import { getPeersForProtocol, selectRandomPeer } from "../select_peer";
import { hexToBytes } from "../utils";
import { DecryptionMethod, WakuMessage } from "../waku_message";

import { HistoryRPC, PageDirection } from "./history_rpc";

const dbg = debug("waku:store");

export const DefaultPageSize = 10;

export { PageDirection, StoreCodecs };

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
   * - [[PageDirection.BACKWARD]]: Most recent page first.
   * - [[PageDirection.FORWARD]]: Oldest page first.
   *
   * Note: This does not affect the ordering of messages with the page
   * (oldest message is always first).
   *
   * @default [[PageDirection.BACKWARD]]
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
 *
 * The Waku Store protocol can be used to retrieved historical messages.
 */
export class WakuStore {
  pubSubTopic: string;
  public decryptionKeys: Map<
    Uint8Array,
    { method?: DecryptionMethod; contentTopics?: string[] }
  >;

  constructor(public libp2p: Libp2p, options?: CreateOptions) {
    if (options?.pubSubTopic) {
      this.pubSubTopic = options.pubSubTopic;
    } else {
      this.pubSubTopic = DefaultPubSubTopic;
    }

    this.decryptionKeys = new Map();
  }

  /**
   * Do a query to a Waku Store to retrieve historical/missed messages.
   *
   * @param contentTopics The content topics to pass to the query, leave empty to
   * retrieve all messages.
   * @param options Optional parameters.
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
      startTime = options.timeFilter.startTime;
      endTime = options.timeFilter.endTime;
    }

    const opts = Object.assign(
      {
        pubSubTopic: this.pubSubTopic,
        pageDirection: PageDirection.BACKWARD,
        pageSize: DefaultPageSize,
      },
      options,
      { contentTopics, startTime, endTime }
    );

    dbg("Querying history with the following options", {
      peerId: options?.peerId?.toB58String(),
      ...options,
    });

    let peer;
    if (opts.peerId) {
      peer = await this.libp2p.peerStore.get(opts.peerId);
      if (!peer)
        throw `Failed to retrieve connection details for provided peer in peer store: ${opts.peerId.toB58String()}`;
    } else {
      peer = await this.randomPeer;
      if (!peer)
        throw "Failed to find known peer that registers waku store protocol";
    }

    let storeCodec = "";
    for (const codec of Object.values(StoreCodecs)) {
      if (peer.protocols.includes(codec)) {
        storeCodec = codec;
        // Do not break as we want to keep the last value
      }
    }
    dbg(`Use store codec ${storeCodec}`);
    if (!storeCodec)
      throw `Peer does not register waku store protocol: ${peer.id.toB58String()}`;

    Object.assign(opts, { storeCodec });
    const connection = this.libp2p.connectionManager.get(peer.id);
    if (!connection) throw "Failed to get a connection to the peer";

    const decryptionKeys = Array.from(this.decryptionKeys).map(
      ([key, { method, contentTopics }]) => {
        return {
          key,
          method,
          contentTopics,
        };
      }
    );

    // Add the decryption keys passed to this function against the
    // content topics also passed to this function.
    if (opts.decryptionKeys) {
      opts.decryptionKeys.forEach((key) => {
        decryptionKeys.push({
          key: hexToBytes(key),
          contentTopics: contentTopics.length ? contentTopics : undefined,
          method: undefined,
        });
      });
    }

    const messages: WakuMessage[] = [];
    let cursor = undefined;
    while (true) {
      const { stream } = await connection.newStream(storeCodec);
      const queryOpts = Object.assign(opts, { cursor });
      const historyRpcQuery = HistoryRPC.createQuery(queryOpts);
      dbg("Querying store peer", connection.remoteAddr.toString());

      const res = await pipe(
        [historyRpcQuery.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        concat
      );
      const reply = historyRpcQuery.decode(res.slice());

      const response = reply.response;
      if (!response) {
        throw "History response misses response field";
      }

      if (response.error) {
        throw "History response contains an Error" + response.error;
      }

      if (!response.messages || !response.messages.length) {
        // No messages left (or stored)
        console.log("No messages present in HistoryRPC response");
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
        console.log("No cursor returned by peer.");
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
  addDecryptionKey(
    key: Uint8Array | string,
    options?: { method?: DecryptionMethod; contentTopics?: string[] }
  ): void {
    this.decryptionKeys.set(hexToBytes(key), options ?? {});
  }

  /**cursorV2Beta4
   * Delete a decryption key that was used to attempt decryption of messages
   * received in subsequent [[queryHistory]] calls.
   *
   * Strings must be in hex format.
   */
  deleteDecryptionKey(key: Uint8Array | string): void {
    this.decryptionKeys.delete(hexToBytes(key));
  }

  /**
   * Returns known peers from the address book (`libp2p.peerStore`) that support
   * store protocol. Waku may or  may not be currently connected to these peers.
   */
  get peers(): AsyncIterable<Peer> {
    const codecs = [];
    for (const codec of Object.values(StoreCodecs)) {
      codecs.push(codec);
    }

    return getPeersForProtocol(this.libp2p, codecs);
  }

  /**
   * Returns a random peer that supports store protocol from the address
   * book (`libp2p.peerStore`). Waku may or  may not be currently connected to
   * this peer.
   */
  get randomPeer(): Promise<Peer | undefined> {
    return selectRandomPeer(this.peers);
  }
}
