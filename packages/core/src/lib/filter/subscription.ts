import { Stream } from "@libp2p/interface/connection";
import {
  CustomEvent,
  EventEmitter,
  EventHandler
} from "@libp2p/interface/events";
import type { Peer } from "@libp2p/interface/peer-store";
import type {
  ContentTopic,
  EventDetail,
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
export class Subscription {
  private readonly peer: Peer;
  private readonly pubsubTopic: PubsubTopic;
  private newStream: (peer: Peer) => Promise<Stream>;
  private readonly decoders: Map<ContentTopic, IDecoder<IDecodedMessage>[]>;
  private readonly eventEmitter: EventEmitter<SubscriptionEventMap>;

  constructor(
    pubsubTopic: PubsubTopic,
    remotePeer: Peer,
    newStream: (peer: Peer) => Promise<Stream>,
    decoders: IDecoder<IDecodedMessage>[]
  ) {
    this.eventEmitter = new EventEmitter();
    this.peer = remotePeer;
    this.pubsubTopic = pubsubTopic;
    this.newStream = newStream;
    this.decoders = groupByContentTopic(decoders);
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
    try {
      // check if the decoders received now are not already present in the decoders map
      // else add them
      this.setNewDecoders(decoders);

      const contentTopics = this.getContentTopics(decoders);

      const request = FilterSubscribeRpc.createSubscribeRequest(
        this.pubsubTopic,
        contentTopics
      );

      const response = await this.sendSubscribeRequest(request);
      if (!response) return;

      this.processSubscribeResponse(response, decoders);
    } catch (error) {
      const errorMsg = "Error subscribing: " + error;
      this.dispatchError(this.pubsubTopic, errorMsg);
    }
  }

  async unsubscribe(contentTopics: ContentTopic[]): Promise<void> {
    try {
      const stream = await this.newStream(this.peer);
      const unsubscribeRequest = FilterSubscribeRpc.createUnsubscribeRequest(
        this.pubsubTopic,
        contentTopics
      );

      await pipe([unsubscribeRequest.encode()], lp.encode, stream.sink);

      this.removeExistingDecoders(contentTopics);
    } catch (error) {
      const errorMsg = "Error unsubscribing: " + error;
      this.dispatchError(this.pubsubTopic, errorMsg);
    }
  }

  async ping(): Promise<void> {
    try {
      const stream = await this.newStream(this.peer);

      const request = FilterSubscribeRpc.createSubscriberPingRequest();

      const res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      if (!res || !res.length)
        throw `No response received for request ${request.requestId}: ${res}`;

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300)
        throw `Filter ping request ${requestId} failed with status code ${statusCode}: ${statusDesc}`;

      log.info("Ping successful");
    } catch (error) {
      const errorMsg = "Error pinging: " + error;
      this.dispatchError(this.pubsubTopic, errorMsg);
    }
  }

  async unsubscribeAll(): Promise<void> {
    try {
      const stream = await this.newStream(this.peer);

      const request = FilterSubscribeRpc.createUnsubscribeAllRequest(
        this.pubsubTopic
      );

      const res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      if (!res || !res.length)
        throw `No response received for request ${request.requestId}: ${res}`;

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300)
        throw `Filter unsubscribe all request ${requestId} failed with status code ${statusCode}: ${statusDesc}`;

      for (const decoders of this.decoders.values()) {
        for (const decoder of decoders) {
          this.eventEmitter.removeEventListener(decoder.contentTopic);
        }
      }
    } catch (error) {
      const errorMsg = "Error unsubscribing all: " + error;
      this.dispatchError(this.pubsubTopic, errorMsg);
    }
  }

  addEventListener(
    contentTopic: string,
    listener: EventHandler<CustomEvent<EventDetail>>
  ): void {
    try {
      const decoders = this.decoders.get(contentTopic);
      if (!decoders || decoders.length === 0)
        throw "No decoders found for content topic " + contentTopic;

      // Check if all decoders are for the correct pubsub topic
      for (const decoder of decoders) {
        if (decoder.pubsubTopic !== this.pubsubTopic) {
          throw `Invalid decoder received. Expected decoder for pubsub topic ${this.pubsubTopic} but received decoder for pubsub topic ${decoder.pubsubTopic}`;
        }
      }

      this.eventEmitter.addEventListener(contentTopic, listener);
    } catch (error) {
      const errorMsg = "Error adding event listener: " + error;
      this.dispatchError(this.pubsubTopic, errorMsg);
      return;
    }
  }

  async processMessage(message: WakuMessage): Promise<void> {
    try {
      const { contentTopic } = message;
      if (!contentTopic) {
        log.info("Message has no content topic, skipping");
        return;
      }

      const decoders = this.decoders.get(contentTopic);
      if (decoders && decoders.length > 0) {
        for (const decoder of decoders) {
          try {
            const decodedMessage = await decoder.fromProtoObj(
              this.pubsubTopic,
              message as IProtoMessage
            );
            if (decodedMessage) {
              this.dispatchData(decoder.contentTopic, decodedMessage);
              return; // Stop after successful decoding
            }
          } catch (e) {
            // Log error but continue trying with other decoders
            log.warn(`Error decoding message with decoder: ${e}`);
          }
        }
        // If no decoder succeeded
        throw `No decoder succeeded in decoding message with content topic ${contentTopic}`;
      } else {
        throw `No decoder found for content topic: ${contentTopic}`;
      }
    } catch (error) {
      const errorMsg = "Error processing message: " + error;
      this.dispatchError(this.pubsubTopic, errorMsg);
    }
  }

  private async sendSubscribeRequest(
    request: FilterSubscribeRpc
  ): Promise<FilterSubscribeResponse | void> {
    const stream = await this.newStream(this.peer);
    const res = await pipe(
      [request.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    if (!res || !res.length)
      // throwing here as it is caught in the caller function
      throw `No response received for request ${request.requestId}: ${res}`;

    return FilterSubscribeResponse.decode(res[0].slice());
  }

  private processSubscribeResponse<T extends IDecodedMessage>(
    response: FilterSubscribeResponse,
    decoders: IDecoder<T> | IDecoder<T>[]
  ): void {
    const { statusCode, requestId, statusDesc } = response;

    if (statusCode < 200 || statusCode >= 300)
      // throwing here as it is caught in the caller function
      throw `Filter subscribe request ${requestId} failed with status code ${statusCode}: ${statusDesc}`;

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
      const existingDecoders = this.decoders.get(decoder.contentTopic) || [];
      if (!existingDecoders.includes(decoder)) {
        this.decoders.set(decoder.contentTopic, [...existingDecoders, decoder]);
      }
    });
  }

  private removeExistingDecoders(contentTopics: ContentTopic[]): void {
    contentTopics.forEach((contentTopic: string) => {
      try {
        const decoders = this.decoders.get(contentTopic);
        if (!decoders || decoders.length === 0)
          throw "No decoder found for content topic " + contentTopic;
        for (const decoder of decoders) {
          this.eventEmitter.removeEventListener(decoder.contentTopic);
        }
        this.decoders.delete(contentTopic);
      } catch (error) {
        const errorMsg = "Error removing event listener: " + error;
        this.dispatchError(this.pubsubTopic, errorMsg);
      }
    });
  }

  private dispatchData(
    contentTopic: ContentTopic,
    data: IDecodedMessage
  ): void {
    this.eventEmitter.dispatchEvent(
      new CustomEvent<EventDetail>(contentTopic, { detail: { data } })
    );
  }

  private dispatchError(contentTopic: ContentTopic, errorMsg: string): void {
    this.eventEmitter.dispatchEvent(
      new CustomEvent<EventDetail>(contentTopic, {
        detail: { error: new Error(errorMsg) }
      })
    );
  }
}
