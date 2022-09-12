import type { Connection } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import { Peer } from "@libp2p/interface-peer-store";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Libp2p } from "libp2p";
import { Uint8ArrayList } from "uint8arraylist";

import * as protoV2Beta4 from "../../proto/store_v2beta4";
import { HistoryResponse } from "../../proto/store_v2beta4";
import { DefaultPubSubTopic, StoreCodecs } from "../constants";
import { selectConnection } from "../select_connection";
import { getPeersForProtocol, selectPeerForProtocol } from "../select_peer";
import { hexToBytes } from "../utils";
import {
  DecryptionMethod,
  DecryptionParams,
  WakuMessage,
} from "../waku_message";

import { HistoryRPC, PageDirection, Params } from "./history_rpc";

import HistoryError = HistoryResponse.HistoryError;

const log = debug("waku:store");

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
   * - { @link PageDirection.BACKWARD }: Most recent page first.
   * - { @link PageDirection.FORWARD }: Oldest page first.
   *
   * Note: This does not affect the ordering of messages with the page
   * (oldest message is always first).
   *
   * @default { @link PageDirection.BACKWARD }
   */
  pageDirection?: PageDirection;
  /**
   * The number of message per page.
   *
   * @default { @link DefaultPageSize }
   */
  pageSize?: number;
  /**
   * Retrieve messages with a timestamp within the provided values.
   */
  timeFilter?: TimeFilter;
  /**
   * Keys that will be used to decrypt messages.
   *
   * It can be Asymmetric Private Keys and Symmetric Keys in the same array,
   * all keys will be tried with both methods.
   */
  decryptionParams?: DecryptionParams[];
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
    this.pubSubTopic = options?.pubSubTopic ?? DefaultPubSubTopic;

    this.decryptionKeys = new Map();
  }

  /**
   * Do a query to a Waku Store to retrieve historical/missed messages.
   *
   * @param contentTopics The content topics to pass to the query, leave empty to
   * retrieve all messages.
   * @param callback called on a page of retrieved messages. If the callback returns `true`
   * then pagination is stopped.
   * @param options Optional parameters.
   *
   * @throws If not able to reach a Waku Store peer to query
   * or if an error is encountered when processing the reply.
   */
  async queryHistory(
    contentTopics: string[],
    callback: (
      messages: Array<Promise<WakuMessage | undefined>>
    ) => Promise<void | boolean> | boolean | void,
    options?: QueryOptions
  ): Promise<void> {
    let startTime, endTime;

    if (options?.timeFilter) {
      startTime = options.timeFilter.startTime;
      endTime = options.timeFilter.endTime;
    }

    const queryOpts = Object.assign(
      {
        pubSubTopic: this.pubSubTopic,
        pageDirection: PageDirection.BACKWARD,
        pageSize: DefaultPageSize,
      },
      options,
      { contentTopics, startTime, endTime }
    );

    log("Querying history with the following options", {
      peerId: options?.peerId?.toString(),
      ...options,
    });

    const res = await selectPeerForProtocol(
      this.libp2p.peerStore,
      Object.values(StoreCodecs),
      options?.peerId
    );

    if (!res) {
      throw new Error("Failed to get a peer");
    }
    const { peer, protocol } = res;

    const connections = this.libp2p.connectionManager.getConnections(peer.id);
    const connection = selectConnection(connections);

    if (!connection) throw "Failed to get a connection to the peer";

    let decryptionParams: DecryptionParams[] = [];

    this.decryptionKeys.forEach(({ method, contentTopics }, key) => {
      decryptionParams.push({
        key,
        method,
        contentTopics,
      });
    });

    // Add the decryption keys passed to this function against the
    // content topics also passed to this function.
    if (options?.decryptionParams) {
      decryptionParams = decryptionParams.concat(options.decryptionParams);
    }

    for await (const messagePromises of paginate(
      connection,
      protocol,
      queryOpts,
      decryptionParams
    )) {
      const abort = Boolean(await callback(messagePromises));
      if (abort) {
        // TODO: Also abort underlying generator
        break;
      }
    }
  }

  /**
   * Register a decryption key to attempt decryption of messages received in any
   * subsequent { @link queryHistory } call. This can either be a private key for
   * asymmetric encryption or a symmetric key. { @link WakuStore } will attempt to
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
   * received in subsequent { @link queryHistory } calls.
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
  async peers(): Promise<Peer[]> {
    const codecs = [];
    for (const codec of Object.values(StoreCodecs)) {
      codecs.push(codec);
    }

    return getPeersForProtocol(this.libp2p.peerStore, codecs);
  }
}

async function* paginate(
  connection: Connection,
  protocol: string,
  queryOpts: Params,
  decryptionParams: DecryptionParams[]
): AsyncGenerator<Promise<WakuMessage | undefined>[]> {
  let cursor = undefined;
  while (true) {
    queryOpts = Object.assign(queryOpts, { cursor });

    const stream = await connection.newStream(protocol);
    const historyRpcQuery = HistoryRPC.createQuery(queryOpts);

    log(
      "Querying store peer",
      connection.remoteAddr.toString(),
      `for (${queryOpts.pubSubTopic})`,
      queryOpts.contentTopics
    );

    const res = await pipe(
      [historyRpcQuery.encode()],
      lp.encode(),
      stream,
      lp.decode(),
      async (source) => await all(source)
    );

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => {
      bytes.append(chunk);
    });

    const reply = historyRpcQuery.decode(bytes);

    if (!reply.response) {
      log("Stopping pagination due to store `response` field missing");
      break;
    }

    const response = reply.response as protoV2Beta4.HistoryResponse;

    if (
      response.error &&
      response.error !== HistoryError.ERROR_NONE_UNSPECIFIED
    ) {
      throw "History response contains an Error: " + response.error;
    }

    if (!response.messages) {
      log(
        "Stopping pagination due to store `response.messages` field missing or empty"
      );
      break;
    }

    log(`${response.messages.length} messages retrieved from store`);

    yield response.messages.map((protoMsg) =>
      WakuMessage.decodeProto(protoMsg, decryptionParams)
    );

    cursor = response.pagingInfo?.cursor;
    if (typeof cursor === "undefined") {
      // If the server does not return cursor then there is an issue,
      // Need to abort, or we end up in an infinite loop
      log(
        "Stopping pagination due to `response.pagingInfo.cursor` missing from store response"
      );
      break;
    }

    const responsePageSize = response.pagingInfo?.pageSize;
    const queryPageSize = historyRpcQuery.query?.pagingInfo?.pageSize;
    if (
      // Response page size smaller than query, meaning this is the last page
      responsePageSize &&
      queryPageSize &&
      responsePageSize < queryPageSize
    ) {
      break;
    }
  }
}
