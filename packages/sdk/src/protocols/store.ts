import { sha256 } from "@noble/hashes/sha256";
import { StoreCore, waku_store } from "@waku/core";
import {
  Cursor,
  IDecodedMessage,
  IDecoder,
  IStoreSDK,
  type Libp2p,
  PageDirection,
  type ProtocolCreateOptions
} from "@waku/interfaces";
import { ensurePubsubTopicIsConfigured, isDefined } from "@waku/utils";
import { concat } from "@waku/utils/bytes";

import { utf8ToBytes } from "../index.js";

import { BaseProtocolSDK } from "./base_protocol.js";

export const DefaultPageSize = 10;

// const log = new Logger("sdk:store");

const DEFAULT_NUM_PEERS = 1;

export class StoreSDK extends BaseProtocolSDK implements IStoreSDK {
  public readonly protocol: StoreCore;

  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    // options.numPeersToUse is disregarded: https://github.com/waku-org/js-waku/issues/1685
    super({ numPeersToUse: DEFAULT_NUM_PEERS });

    this.protocol = new StoreCore(libp2p, options);
  }

  /**
   * Do a query to a Waku Store to retrieve historical/missed messages.
   *
   * This is a generator, useful if you want most control on how messages
   * are processed.
   *
   * The order of the messages returned by the remote Waku node SHOULD BE
   * as follows:
   * - within a page, messages SHOULD be ordered from oldest to most recent
   * - pages direction depends on { @link QueryOptions.pageDirection }
   * @throws If not able to reach a Waku Store peer to query,
   * or if an error is encountered when processing the reply,
   * or if two decoders with the same content topic are passed.
   *
   * This API only supports querying a single pubsub topic at a time.
   * If multiple decoders are provided, they must all have the same pubsub topic.
   * @throws If multiple decoders with different pubsub topics are provided.
   * @throws If no decoders are provided.
   * @throws If no decoders are found for the provided pubsub topic.
   */
  async *queryGenerator<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    options?: waku_store.QueryOptions
  ): AsyncGenerator<Promise<T | undefined>[]> {
    const { pubsubTopic, contentTopics, decodersAsMap } =
      this.validateDecodersAndPubsubTopic(decoders, options);

    const queryOpts = this.constructOptions(
      pubsubTopic,
      contentTopics,
      options
    );

    const peer = (
      await this.protocol.getPeers({
        numPeers: this.numPeers,
        maxBootstrapPeers: 1
      })
    )[0];

    if (!peer) throw new Error("No peers available to query");

    const responseGenerator = this.protocol.queryPerPage(
      queryOpts,
      decodersAsMap,
      peer
    );

    for await (const messages of responseGenerator) {
      yield messages;
    }
  }

  /**
   * @deprecated Use `queryWithOrderedCallback` instead
   **/
  queryOrderedCallback = this.queryWithOrderedCallback;

  /**
   * Do a query to a Waku Store to retrieve historical/missed messages.
   *
   * The callback function takes a `WakuMessage` in input,
   * messages are processed in order:
   * - oldest to latest if `options.pageDirection` == { @link PageDirection.FORWARD }
   * - latest to oldest if `options.pageDirection` == { @link PageDirection.BACKWARD }
   *
   * The ordering may affect performance.
   * The ordering depends on the behavior of the remote store node.
   * If strong ordering is needed, you may need to handle this at application level
   * and set your own timestamps too (the WakuMessage timestamps are not certified).
   *
   * @throws If not able to reach a Waku Store peer to query,
   * or if an error is encountered when processing the reply,
   * or if two decoders with the same content topic are passed.
   */
  async queryWithOrderedCallback<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void,
    options?: waku_store.QueryOptions
  ): Promise<void> {
    for await (const promises of this.queryGenerator(decoders, options)) {
      if (await this.processMessages(promises, callback, options)) break;
    }
  }

  /**
   * Do a query to a Waku Store to retrieve historical/missed messages.
   * The callback function takes a `Promise<WakuMessage>` in input,
   * useful if messages need to be decrypted and performance matters.
   *
   * The order of the messages passed to the callback is as follows:
   * - within a page, messages are expected to be ordered from oldest to most recent
   * - pages direction depends on { @link QueryOptions.pageDirection }
   *
   * Do note that the resolution of the `Promise<WakuMessage | undefined` may
   * break the order as it may rely on the browser decryption API, which in turn,
   * may have a different speed depending on the type of decryption.
   *
   * @throws If not able to reach a Waku Store peer to query,
   * or if an error is encountered when processing the reply,
   * or if two decoders with the same content topic are passed.
   */
  async queryWithPromiseCallback<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: (
      message: Promise<T | undefined>
    ) => Promise<void | boolean> | boolean | void,
    options?: waku_store.QueryOptions
  ): Promise<void> {
    let abort = false;
    for await (const page of this.queryGenerator(decoders, options)) {
      const _promises = page.map(async (msgPromise) => {
        if (abort) return;
        abort = Boolean(await callback(msgPromise));
      });

      await Promise.all(_promises);
      if (abort) break;
    }
  }

  createCursor(message: IDecodedMessage): Cursor {
    if (
      !message ||
      !message.timestamp ||
      !message.payload ||
      !message.contentTopic
    ) {
      throw new Error("Message is missing required fields");
    }

    const contentTopicBytes = utf8ToBytes(message.contentTopic);

    const digest = sha256(concat([contentTopicBytes, message.payload]));

    const messageTime = BigInt(message.timestamp.getTime()) * BigInt(1000000);

    return {
      digest,
      pubsubTopic: message.pubsubTopic,
      senderTime: messageTime,
      receiverTime: messageTime
    };
  }

  private validateDecodersAndPubsubTopic<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    options?: waku_store.QueryOptions
  ): {
    pubsubTopic: string;
    contentTopics: string[];
    decodersAsMap: Map<string, IDecoder<T>>;
  } {
    if (decoders.length === 0) {
      throw new Error("No decoders provided");
    }

    // convert array to set to remove duplicates
    const uniquePubsubTopicsInQuery = Array.from(
      new Set(decoders.map((decoder) => decoder.pubsubTopic))
    );
    // If multiple pubsub topics are provided, throw an error
    if (uniquePubsubTopicsInQuery.length > 1) {
      throw new Error(
        "API does not support querying multiple pubsub topics at once"
      );
    }

    // we can be certain that there is only one pubsub topic in the query
    const pubsubTopicForQuery = uniquePubsubTopicsInQuery[0];

    ensurePubsubTopicIsConfigured(
      pubsubTopicForQuery,
      this.protocol.pubsubTopics
    );

    // check that the pubsubTopic from the Cursor and Decoder match
    if (
      options?.cursor?.pubsubTopic &&
      options.cursor.pubsubTopic !== pubsubTopicForQuery
    ) {
      throw new Error(
        `Cursor pubsub topic (${options?.cursor?.pubsubTopic}) does not match decoder pubsub topic (${pubsubTopicForQuery})`
      );
    }

    const decodersAsMap = new Map();
    decoders.forEach((dec) => {
      if (decodersAsMap.has(dec.contentTopic)) {
        throw new Error(
          "API does not support different decoder per content topic"
        );
      }
      decodersAsMap.set(dec.contentTopic, dec);
    });

    const contentTopics = decoders
      .filter((decoder) => decoder.pubsubTopic === pubsubTopicForQuery)
      .map((dec) => dec.contentTopic);

    if (contentTopics.length === 0) {
      throw new Error("No decoders found for topic " + pubsubTopicForQuery);
    }

    return {
      pubsubTopic: pubsubTopicForQuery,
      contentTopics,
      decodersAsMap
    };
  }

  private constructOptions(
    pubsubTopic: string,
    contentTopics: string[],
    options: waku_store.QueryOptions = {}
  ): waku_store.Params {
    let startTime, endTime;

    if (options?.timeFilter) {
      startTime = options.timeFilter.startTime;
      endTime = options.timeFilter.endTime;
    }

    const queryOpts = Object.assign(
      {
        pubsubTopic: pubsubTopic,
        pageDirection: PageDirection.BACKWARD,
        pageSize: DefaultPageSize
      },
      options,
      { contentTopics, startTime, endTime }
    );

    return queryOpts;
  }

  /**
   * Processes messages based on the provided callback and options.
   * @private
   */
  private async processMessages<T extends IDecodedMessage>(
    messages: Promise<T | undefined>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void,
    options?: waku_store.QueryOptions
  ): Promise<boolean> {
    let abort = false;
    const messagesOrUndef: Array<T | undefined> = await Promise.all(messages);
    let processedMessages: Array<T> = messagesOrUndef.filter(isDefined);

    if (this.shouldReverseOrder(options)) {
      processedMessages = processedMessages.reverse();
    }

    await Promise.all(
      processedMessages.map(async (msg) => {
        if (msg && !abort) {
          abort = Boolean(await callback(msg));
        }
      })
    );

    return abort;
  }

  /**
   * Determines whether to reverse the order of messages based on the provided options.
   *
   * Messages in pages are ordered from oldest (first) to most recent (last).
   * https://github.com/vacp2p/rfc/issues/533
   *
   * @private
   */
  private shouldReverseOrder(options?: waku_store.QueryOptions): boolean {
    return (
      typeof options?.pageDirection === "undefined" ||
      options?.pageDirection === PageDirection.BACKWARD
    );
  }
}

export function wakuStore(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => IStoreSDK {
  return (libp2p: Libp2p) => new StoreSDK(libp2p, init);
}
