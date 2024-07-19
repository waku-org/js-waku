import type { Peer } from "@libp2p/interface";
import {
  Cursor,
  IDecodedMessage,
  IDecoder,
  IStoreCore,
  Libp2p,
  ProtocolCreateOptions
} from "@waku/interfaces";
import { proto_store as proto } from "@waku/proto";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { BaseProtocol } from "../base_protocol.js";
import { toProtoMessage } from "../to_proto_message.js";

import { HistoryRpc, PageDirection, Params } from "./history_rpc.js";

import HistoryError = proto.HistoryResponse.HistoryError;

const log = new Logger("store");

export const StoreCodec = "/vac/waku/store/2.0.0-beta4";

export { PageDirection, Params };

export interface TimeFilter {
  startTime: Date;
  endTime: Date;
}

export interface QueryOptions {
  /**
   * The direction in which pages are retrieved:
   * - { @link PageDirection.BACKWARD }: Most recent page first.
   * - { @link PageDirection.FORWARD }: Oldest page first.
   *
   * Note: This does not affect the ordering of messages with the page
   * (the oldest message is always first).
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
   * Cursor as an index to start a query from.
   * The cursor index will be exclusive (i.e. the message at the cursor index will not be included in the result).
   * If undefined, the query will start from the beginning or end of the history, depending on the page direction.
   */
  cursor?: Cursor;
}

/**
 * Implements the [Waku v2 Store protocol](https://rfc.vac.dev/spec/13/).
 *
 * The Waku Store protocol can be used to retrieved historical messages.
 */
export class StoreCore extends BaseProtocol implements IStoreCore {
  public constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(StoreCodec, libp2p.components, log, options!.pubsubTopics!, options);
  }

  public async *queryPerPage<T extends IDecodedMessage>(
    queryOpts: Params,
    decoders: Map<string, IDecoder<T>>,
    peer: Peer
  ): AsyncGenerator<Promise<T | undefined>[]> {
    if (
      queryOpts.contentTopics.toString() !==
      Array.from(decoders.keys()).toString()
    ) {
      throw new Error(
        "Internal error, the decoders should match the query's content topics"
      );
    }

    let currentCursor = queryOpts.cursor;
    while (true) {
      queryOpts.cursor = currentCursor;

      const historyRpcQuery = HistoryRpc.createQuery(queryOpts);

      let stream;
      try {
        stream = await this.getStream(peer);
      } catch (e) {
        log.error("Failed to get stream", e);
        break;
      }

      const res = await pipe(
        [historyRpcQuery.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      const bytes = new Uint8ArrayList();
      res.forEach((chunk) => {
        bytes.append(chunk);
      });

      const reply = historyRpcQuery.decode(bytes);

      if (!reply.response) {
        log.warn("Stopping pagination due to store `response` field missing");
        break;
      }

      const response = reply.response as proto.HistoryResponse;

      if (response.error && response.error !== HistoryError.NONE) {
        throw "History response contains an Error: " + response.error;
      }

      if (!response.messages || !response.messages.length) {
        log.warn(
          "Stopping pagination due to store `response.messages` field missing or empty"
        );
        break;
      }

      log.error(`${response.messages.length} messages retrieved from store`);

      yield response.messages.map((protoMsg) => {
        const contentTopic = protoMsg.contentTopic;
        if (typeof contentTopic !== "undefined") {
          const decoder = decoders.get(contentTopic);
          if (decoder) {
            return decoder.fromProtoObj(
              queryOpts.pubsubTopic,
              toProtoMessage(protoMsg)
            );
          }
        }
        return Promise.resolve(undefined);
      });

      const nextCursor = response.pagingInfo?.cursor;
      if (typeof nextCursor === "undefined") {
        // If the server does not return cursor then there is an issue,
        // Need to abort, or we end up in an infinite loop
        log.warn(
          "Stopping pagination due to `response.pagingInfo.cursor` missing from store response"
        );
        break;
      }

      currentCursor = nextCursor;

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
}
