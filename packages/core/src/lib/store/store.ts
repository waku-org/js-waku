import type { PeerId } from "@libp2p/interface";
import {
  IDecodedMessage,
  IDecoder,
  Libp2p,
  QueryRequestParams
} from "@waku/interfaces";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { StreamManager } from "../stream_manager/index.js";
import { toProtoMessage } from "../to_proto_message.js";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_TIME_RANGE,
  StoreQueryRequest,
  StoreQueryResponse
} from "./rpc.js";

const log = new Logger("store");

export const StoreCodec = "/vac/waku/store-query/3.0.0";

export class StoreCore {
  private readonly streamManager: StreamManager;

  public readonly multicodec = [StoreCodec];

  public constructor(libp2p: Libp2p) {
    this.streamManager = new StreamManager(StoreCodec, libp2p.components);
  }

  public get maxTimeLimit(): number {
    return MAX_TIME_RANGE;
  }

  public async *queryPerPage<T extends IDecodedMessage>(
    queryOpts: QueryRequestParams,
    decoders: Map<string, IDecoder<T>>,
    peerId: PeerId
  ): AsyncGenerator<Promise<T | undefined>[]> {
    if (queryOpts.timeStart && queryOpts.timeEnd) {
      const timeDiff =
        queryOpts.timeEnd.getTime() - queryOpts.timeStart.getTime();
      if (timeDiff > MAX_TIME_RANGE) {
        throw new Error("Time range bigger than 24h");
      }
    }

    // Only validate decoder content topics for content-filtered queries
    const isHashQuery =
      queryOpts.messageHashes && queryOpts.messageHashes.length > 0;
    if (
      !isHashQuery &&
      queryOpts.contentTopics &&
      queryOpts.contentTopics.toString() !==
        Array.from(decoders.keys()).toString()
    ) {
      throw new Error(
        "Internal error, the decoders should match the query's content topics"
      );
    }

    let currentCursor = queryOpts.paginationCursor;
    while (true) {
      const storeQueryRequest = StoreQueryRequest.create({
        ...queryOpts,
        paginationCursor: currentCursor
      });

      log.info("Sending store query request:", {
        hasMessageHashes: !!queryOpts.messageHashes?.length,
        messageHashCount: queryOpts.messageHashes?.length,
        pubsubTopic: queryOpts.pubsubTopic,
        contentTopics: queryOpts.contentTopics
      });

      const stream = await this.streamManager.getStream(peerId);

      if (!stream) {
        log.error(
          `Failed to get a stream for remote peer:${peerId.toString()}`
        );
        break;
      }

      const res = await pipe(
        [storeQueryRequest.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      const bytes = new Uint8ArrayList();
      res.forEach((chunk) => {
        bytes.append(chunk);
      });

      const storeQueryResponse = StoreQueryResponse.decode(bytes);

      if (
        !storeQueryResponse.statusCode ||
        storeQueryResponse.statusCode >= 300
      ) {
        const errorMessage = `Store query failed with status code: ${storeQueryResponse.statusCode}, description: ${storeQueryResponse.statusDesc}`;
        log.error(errorMessage);
        throw new Error(errorMessage);
      }

      if (!storeQueryResponse.messages || !storeQueryResponse.messages.length) {
        log.warn("Stopping pagination due to empty messages in response");
        break;
      }

      log.info(
        `${storeQueryResponse.messages.length} messages retrieved from store`
      );

      const decodedMessages = storeQueryResponse.messages.map((protoMsg) => {
        if (!protoMsg.message) {
          return Promise.resolve(undefined);
        }
        const contentTopic = protoMsg.message.contentTopic;
        if (contentTopic) {
          const decoder = decoders.get(contentTopic);
          if (decoder) {
            return decoder.fromProtoObj(
              protoMsg.pubsubTopic || "",
              toProtoMessage(protoMsg.message)
            );
          }
        }
        return Promise.resolve(undefined);
      });

      yield decodedMessages;

      if (queryOpts.paginationForward) {
        currentCursor =
          storeQueryResponse.messages[storeQueryResponse.messages.length - 1]
            .messageHash;
      } else {
        currentCursor = storeQueryResponse.messages[0].messageHash;
      }

      if (
        storeQueryResponse.messages.length > MAX_PAGE_SIZE &&
        storeQueryResponse.messages.length <
          (queryOpts.paginationLimit || DEFAULT_PAGE_SIZE)
      ) {
        break;
      }
    }
  }
}
