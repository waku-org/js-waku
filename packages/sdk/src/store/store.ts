import type { PeerId } from "@libp2p/interface";
import { ConnectionManager, messageHash, StoreCore } from "@waku/core";
import {
  IDecodedMessage,
  IDecoder,
  IStore,
  Libp2p,
  QueryRequestParams,
  StoreCursor,
  StoreProtocolOptions
} from "@waku/interfaces";
import { ensurePubsubTopicIsConfigured, isDefined, Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

const log = new Logger("waku:store:sdk");

type StoreConstructorParams = {
  connectionManager: ConnectionManager;
  libp2p: Libp2p;
  peerManager: PeerManager;
  options?: Partial<StoreProtocolOptions>;
};

/**
 * StoreSDK is an implementation of the IStoreSDK interface.
 * It provides methods to interact with the Waku Store protocol.
 */
export class Store implements IStore {
  private options: Partial<StoreProtocolOptions>;
  private peerManager: PeerManager;
  private connectionManager: ConnectionManager;

  public readonly protocol: StoreCore;

  public constructor(params: StoreConstructorParams) {
    this.options = params.options || {};
    this.peerManager = params.peerManager;
    this.connectionManager = params.connectionManager;

    this.protocol = new StoreCore(
      params.connectionManager.pubsubTopics,
      params.libp2p
    );
  }

  /**
   * Queries the Waku Store for historical messages using the provided decoders and options.
   * Returns an asynchronous generator that yields promises of decoded messages.
   *
   * @param decoders - An array of message decoders.
   * @param options - Optional query parameters.
   * @returns An asynchronous generator of promises of decoded messages.
   * @throws If no peers are available to query or if an error occurs during the query.
   */
  public async *queryGenerator<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    options?: Partial<QueryRequestParams>
  ): AsyncGenerator<Promise<T | undefined>[]> {
    const { pubsubTopic, contentTopics, decodersAsMap } =
      this.validateDecodersAndPubsubTopic(decoders);

    const queryOpts = {
      pubsubTopic,
      contentTopics,
      includeData: true,
      paginationForward: true,
      ...options
    };

    const peer = await this.getPeerToUse();

    if (!peer) {
      log.error("No peers available to query");
      throw new Error("No peers available to query");
    }

    log.info(`Querying store with options: ${JSON.stringify(options)}`);
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
   * Queries the Waku Store for historical messages and processes them with the provided callback in order.
   *
   * @param decoders - An array of message decoders.
   * @param callback - A callback function to process each decoded message.
   * @param options - Optional query parameters.
   * @returns A promise that resolves when the query and message processing are completed.
   */
  public async queryWithOrderedCallback<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void,
    options?: Partial<QueryRequestParams>
  ): Promise<void> {
    log.info("Querying store with ordered callback");
    for await (const promises of this.queryGenerator(decoders, options)) {
      if (await this.processMessages(promises, callback)) break;
    }
  }

  /**
   * Queries the Waku Store for historical messages and processes them with the provided callback using promises.
   *
   * @param decoders - An array of message decoders.
   * @param callback - A callback function to process each promise of a decoded message.
   * @param options - Optional query parameters.
   * @returns A promise that resolves when the query and message processing are completed.
   */
  public async queryWithPromiseCallback<T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: (
      message: Promise<T | undefined>
    ) => Promise<void | boolean> | boolean | void,
    options?: Partial<QueryRequestParams>
  ): Promise<void> {
    log.info("Querying store with promise callback");
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

  /**
   * Processes messages based on the provided callback and options.
   *
   * @param messages - An array of promises of decoded messages.
   * @param callback - A callback function to process each decoded message.
   * @returns A promise that resolves to a boolean indicating whether the processing should abort.
   * @private
   */
  private async processMessages<T extends IDecodedMessage>(
    messages: Promise<T | undefined>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void
  ): Promise<boolean> {
    let abort = false;
    const messagesOrUndef: Array<T | undefined> = await Promise.all(messages);
    const processedMessages: Array<T> = messagesOrUndef.filter(isDefined);

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
   * Creates a cursor based on the provided decoded message.
   *
   * @param message - The decoded message.
   * @returns A StoreCursor representing the message.
   */
  public createCursor(message: IDecodedMessage): StoreCursor {
    return messageHash(message.pubsubTopic, message);
  }

  /**
   * Validates the provided decoders and pubsub topic.
   *
   * @param decoders - An array of message decoders.
   * @returns An object containing the pubsub topic, content topics, and a map of decoders.
   * @throws If no decoders are provided, if multiple pubsub topics are provided, or if no decoders are found for the pubsub topic.
   * @private
   */
  private validateDecodersAndPubsubTopic<T extends IDecodedMessage>(
    decoders: IDecoder<T>[]
  ): {
    pubsubTopic: string;
    contentTopics: string[];
    decodersAsMap: Map<string, IDecoder<T>>;
  } {
    if (decoders.length === 0) {
      log.error("No decoders provided");
      throw new Error("No decoders provided");
    }

    const uniquePubsubTopicsInQuery = Array.from(
      new Set(decoders.map((decoder) => decoder.pubsubTopic))
    );
    if (uniquePubsubTopicsInQuery.length > 1) {
      log.error("API does not support querying multiple pubsub topics at once");
      throw new Error(
        "API does not support querying multiple pubsub topics at once"
      );
    }

    const pubsubTopicForQuery = uniquePubsubTopicsInQuery[0];

    ensurePubsubTopicIsConfigured(
      pubsubTopicForQuery,
      this.protocol.pubsubTopics
    );

    const decodersAsMap = new Map();
    decoders.forEach((dec) => {
      if (decodersAsMap.has(dec.contentTopic)) {
        log.error("API does not support different decoder per content topic");
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
      log.error(`No decoders found for topic ${pubsubTopicForQuery}`);
      throw new Error("No decoders found for topic " + pubsubTopicForQuery);
    }

    return {
      pubsubTopic: pubsubTopicForQuery,
      contentTopics,
      decodersAsMap
    };
  }

  private async getPeerToUse(): Promise<PeerId | undefined> {
    let peerId: PeerId | undefined;

    if (this.options?.peer) {
      const connectedPeers = await this.connectionManager.getConnectedPeers();

      const peer = connectedPeers.find(
        (p) => p.id.toString() === this.options?.peer
      );
      peerId = peer?.id;

      if (!peerId) {
        log.warn(
          `Passed node to use for Store not found: ${this.options.peer}. Attempting to use random peers.`
        );
      }
    }

    const peerIds = this.peerManager.getPeers();

    if (peerIds.length > 0) {
      // TODO(weboko): implement smart way of getting a peer https://github.com/waku-org/js-waku/issues/2243
      return peerIds[Math.floor(Math.random() * peerIds.length)];
    }

    log.error("No peers available to use.");
    return;
  }
}
