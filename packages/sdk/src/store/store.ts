import type { PeerId } from "@libp2p/interface";
import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import { ConnectionManager, messageHash, StoreCore } from "@waku/core";
import {
  IDecodedMessage,
  IDecoder,
  IStore,
  Libp2p,
  Protocols,
  QueryRequestParams,
  StoreCursor,
  StoreProtocolOptions
} from "@waku/interfaces";
import { isDefined, Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

const log = new Logger("waku:store:sdk");

type StoreConstructorParams = {
  libp2p: Libp2p;
  peerManager: PeerManager;
  connectionManager: ConnectionManager;
  options?: Partial<StoreProtocolOptions>;
};

/**
 * StoreSDK is an implementation of the IStoreSDK interface.
 * It provides methods to interact with the Waku Store protocol.
 */
export class Store implements IStore {
  private readonly options: Partial<StoreProtocolOptions>;
  private readonly libp2p: Libp2p;
  private readonly peerManager: PeerManager;
  private readonly connectionManager: ConnectionManager;
  private readonly protocol: StoreCore;

  public constructor(params: StoreConstructorParams) {
    this.options = params.options || {};
    this.peerManager = params.peerManager;
    this.connectionManager = params.connectionManager;
    this.libp2p = params.libp2p;

    this.protocol = new StoreCore(params.libp2p);
  }

  public get multicodec(): string {
    return this.protocol.multicodec;
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
    // For message hash queries, don't validate decoders but still need decodersAsMap
    const isHashQuery =
      options?.messageHashes && options.messageHashes.length > 0;

    let pubsubTopic: string;
    let contentTopics: string[];
    let decodersAsMap: Map<string, IDecoder<T>>;

    if (isHashQuery) {
      // For hash queries, we still need decoders to decode messages
      // but we don't validate pubsubTopic consistency
      // Use pubsubTopic from options if provided, otherwise from first decoder
      pubsubTopic = options.pubsubTopic || decoders[0]?.pubsubTopic || "";
      contentTopics = [];
      decodersAsMap = new Map();
      decoders.forEach((dec) => {
        decodersAsMap.set(dec.contentTopic, dec);
      });
    } else {
      const validated = this.validateDecodersAndPubsubTopic(decoders);
      pubsubTopic = validated.pubsubTopic;
      contentTopics = validated.contentTopics;
      decodersAsMap = validated.decodersAsMap;
    }

    const queryOpts: QueryRequestParams = {
      pubsubTopic,
      contentTopics,
      includeData: true,
      paginationForward: true,
      ...options
    };

    const peer = await this.getPeerToUse(pubsubTopic);

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
    const isTopicSupported =
      this.connectionManager.isTopicConfigured(pubsubTopicForQuery);

    if (!isTopicSupported) {
      throw new Error(
        `Pubsub topic ${pubsubTopicForQuery} has not been configured on this instance.`
      );
    }

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

  private async getPeerToUse(pubsubTopic: string): Promise<PeerId | undefined> {
    const peers = await this.peerManager.getPeers({
      protocol: Protocols.Store,
      pubsubTopic
    });

    const peer = this.options.peers
      ? await this.getPeerFromConfigurationOrFirst(peers, this.options.peers)
      : peers[0];

    return peer;
  }

  private async getPeerFromConfigurationOrFirst(
    peerIds: PeerId[],
    configPeers: string[]
  ): Promise<PeerId | undefined> {
    const storeConfigPeers = configPeers.map(multiaddr);
    const missing = [];

    for (const peer of storeConfigPeers) {
      const matchedPeer = peerIds.find(
        (id) => id.toString() === peer.getPeerId()?.toString()
      );

      if (matchedPeer) {
        return matchedPeer;
      }

      missing.push(peer);
    }

    while (missing.length) {
      const toDial = missing.pop();

      if (!toDial) {
        return;
      }

      try {
        const conn = await this.libp2p.dial(toDial);

        if (conn) {
          return peerIdFromString(toDial.getPeerId() as string);
        }
      } catch (e) {
        log.warn(
          `Failed to dial peer from options.peers list for Store protocol. Peer:${toDial.getPeerId()}, error:${e}`
        );
      }
    }

    log.warn(
      `Passed node to use for Store not found: ${configPeers.toString()}. Attempting to use first available peers.`
    );

    return peerIds[0];
  }
}
