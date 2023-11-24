import { Stream } from "@libp2p/interface/connection";
import {
  CustomEvent,
  EventEmitter,
  EventHandler
} from "@libp2p/interface/events";
import type { Peer } from "@libp2p/interface/peer-store";
import type {
  ContentTopic,
  IDecodedMessage,
  IDecoder,
  IProtoMessage,
  PubsubTopic,
  SubscriptionEventMap
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { groupByContentTopic, Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { FilterSubscribeResponse, FilterSubscribeRpc } from "./filter_rpc.js";

const log = new Logger("waku:filter-v2:subscription");

// one subscription object per pubsub topic
export class Subscription extends EventEmitter<SubscriptionEventMap> {
  private readonly peer: Peer;
  private readonly pubsubTopic: PubsubTopic;
  private newStream: (peer: Peer) => Promise<Stream>;
  private readonly decoders: Map<ContentTopic, IDecoder<IDecodedMessage>>;

  constructor(
    pubsubTopic: PubsubTopic,
    remotePeer: Peer,
    newStream: (peer: Peer) => Promise<Stream>,
    decoders: IDecoder<IDecodedMessage>[]
  ) {
    super();
    this.peer = remotePeer;
    this.pubsubTopic = pubsubTopic;
    this.newStream = newStream;
    this.decoders = new Map(
      decoders.map((decoder) => [decoder.contentTopic, decoder])
    );
  }
  /**
   * Subscribes to a set of topics.
   *
   * This method does not NEED to be invoked manually. It is already invoked
   * as part of `Filter.createSubscription`.
   * You can use this method to subscribe to additional topics, or refresh subscription with an already subscribed topic.
   *
   * @param decoders - The decoders for the topics to subscribe to.
   *
   * @returns A promise that resolves once the subscription is complete.
   */
  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): Promise<void> {
    // check if the decoders received now are not already present in the decoders map
    // else add them
    this.setNewDecoders(decoders);

    const contentTopics = this.getContentTopics(decoders);

    const request = FilterSubscribeRpc.createSubscribeRequest(
      this.pubsubTopic,
      contentTopics
    );

    const response = await this.sendSubscribeRequest(request);

    this.processSubscribeResponse(response, decoders);
  }

  async unsubscribe(contentTopics: ContentTopic[]): Promise<void> {
    const stream = await this.newStream(this.peer);
    const unsubscribeRequest = FilterSubscribeRpc.createUnsubscribeRequest(
      this.pubsubTopic,
      contentTopics
    );

    try {
      await pipe([unsubscribeRequest.encode()], lp.encode, stream.sink);
    } catch (error) {
      throw new Error("Error unsubscribing: " + error);
    }

    this.removeExistingDecoders(contentTopics);
  }

  async ping(): Promise<void> {
    const stream = await this.newStream(this.peer);

    const request = FilterSubscribeRpc.createSubscriberPingRequest();

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      if (!res || !res.length) {
        throw Error(
          `No response received for request ${request.requestId}: ${res}`
        );
      }

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(
          `Filter ping request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
        );
      }

      log.info("Ping successful");
    } catch (error) {
      log.error("Error pinging: ", error);
      throw new Error("Error pinging: " + error);
    }
  }

  async unsubscribeAll(): Promise<void> {
    const stream = await this.newStream(this.peer);

    const request = FilterSubscribeRpc.createUnsubscribeAllRequest(
      this.pubsubTopic
    );

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      if (!res || !res.length) {
        throw Error(
          `No response received for request ${request.requestId}: ${res}`
        );
      }

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(
          `Filter unsubscribe all request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
        );
      }

      for (const decoder of this.decoders.values()) {
        this.removeEventListener(decoder.contentTopic);
      }
      this.decoders.clear();
      log.info("Unsubscribed from all content topics");
    } catch (error) {
      throw new Error("Error unsubscribing from all content topics: " + error);
    }
  }

  addEventListener<K extends string | number>(
    contentTopic: K,
    listener: EventHandler<SubscriptionEventMap[K]> | null,
    options?: boolean | AddEventListenerOptions | undefined
  ): void {
    if (typeof contentTopic !== "string")
      throw new Error(
        `Invalid event type. Expected content topic which should be a string but received ${contentTopic} of the type ${typeof contentTopic}`
      );

    const decoder = this.decoders.get(contentTopic);
    if (!decoder)
      throw new Error("No decoder found for content topic " + contentTopic);
    if (decoder.pubsubTopic !== this.pubsubTopic)
      throw new Error(
        `Invalid decoder received. Expected decoder for pubsub topic ${this.pubsubTopic} but received decoder for pubsub topic ${decoder.pubsubTopic}`
      );

    super.addEventListener(contentTopic, listener, options);
  }

  async processMessage(message: WakuMessage): Promise<void> {
    const { contentTopic } = message;
    if (!contentTopic) {
      log.info("Message has no content topic, skipping");
      return;
    }

    const decoder = this.decoders.get(contentTopic);
    if (decoder) {
      try {
        const decodedMessage = await decoder.fromProtoObj(
          this.pubsubTopic,
          message as IProtoMessage
        );
        if (!decodedMessage) {
          throw new Error("Decoding failed");
        }
        this.dispatchEvent(
          new CustomEvent<IDecodedMessage>(decoder.contentTopic, {
            detail: decodedMessage
          })
        );
      } catch (e) {
        log.error("Error decoding message", e);
      }
    } else {
      log.error("No decoder found for content topic", contentTopic);
    }
  }

  private async sendSubscribeRequest(
    request: FilterSubscribeRpc
  ): Promise<FilterSubscribeResponse> {
    const stream = await this.newStream(this.peer);
    const res = await pipe(
      [request.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    if (!res || !res.length) {
      throw Error(
        `No response received for request ${request.requestId}: ${res}`
      );
    }

    return FilterSubscribeResponse.decode(res[0].slice());
  }

  private processSubscribeResponse<T extends IDecodedMessage>(
    response: FilterSubscribeResponse,
    decoders: IDecoder<T> | IDecoder<T>[]
  ): void {
    const { statusCode, requestId, statusDesc } = response;

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(
        `Filter subscribe request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
      );
    }

    log.info(
      "Subscribed to peer ",
      this.peer.id.toString(),
      "for content topics",
      this.getContentTopics(decoders)
    );
  }

  private getContentTopics<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): ContentTopic[] {
    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];
    const decodersGroupedByCT = groupByContentTopic(decodersArray);
    return Array.from(decodersGroupedByCT.keys());
  }

  private setNewDecoders<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): void {
    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];
    decodersArray.forEach((decoder) => {
      if (!this.decoders.has(decoder.contentTopic)) {
        this.decoders.set(decoder.contentTopic, decoder);
      }
    });
  }

  private removeExistingDecoders(contentTopics: ContentTopic[]): void {
    contentTopics.forEach((contentTopic: string) => {
      const decoder = this.decoders.get(contentTopic);
      if (!decoder)
        throw new Error("No decoder found for content topic " + contentTopic);
      this.removeEventListener(decoder.contentTopic);
      this.decoders.delete(contentTopic);
    });
  }
}
