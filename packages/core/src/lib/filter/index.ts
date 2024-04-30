import type { Peer } from "@libp2p/interface";
import type { IncomingStreamData } from "@libp2p/interface-internal";
import type {
  ContentTopic,
  IBaseProtocolCore,
  Libp2p,
  ProtocolCreateOptions,
  PubsubTopic
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { BaseProtocol } from "../base_protocol.js";

import {
  FilterPushRpc,
  FilterSubscribeResponse,
  FilterSubscribeRpc
} from "./filter_rpc.js";

const log = new Logger("filter:v2");

export const FilterCodecs = {
  SUBSCRIBE: "/vac/waku/filter-subscribe/2.0.0-beta1",
  PUSH: "/vac/waku/filter-push/2.0.0-beta1"
};

export class FilterCore extends BaseProtocol implements IBaseProtocolCore {
  constructor(
    private handleIncomingMessage: (
      pubsubTopic: PubsubTopic,
      wakuMessage: WakuMessage
    ) => Promise<void>,
    libp2p: Libp2p,
    options?: ProtocolCreateOptions
  ) {
    super(
      FilterCodecs.SUBSCRIBE,
      libp2p.components,
      log,
      options!.pubsubTopics!,
      options
    );

    libp2p.handle(FilterCodecs.PUSH, this.onRequest.bind(this)).catch((e) => {
      log.error("Failed to register ", FilterCodecs.PUSH, e);
    });
  }

  private onRequest(streamData: IncomingStreamData): void {
    const { connection, stream } = streamData;
    const { remotePeer } = connection;
    log.info(`Received message from ${remotePeer.toString()}`);
    try {
      pipe(stream, lp.decode, async (source) => {
        for await (const bytes of source) {
          const response = FilterPushRpc.decode(bytes.slice());

          const { pubsubTopic, wakuMessage } = response;

          if (!wakuMessage) {
            log.error("Received empty message");
            return;
          }

          if (!pubsubTopic) {
            log.error("Pubsub topic missing from push message");
            return;
          }

          await this.handleIncomingMessage(pubsubTopic, wakuMessage);
        }
      }).then(
        () => {
          log.info("Receiving pipe closed.");
        },
        (e) => {
          log.error("Error with receiving pipe", e);
        }
      );
    } catch (e) {
      log.error("Error decoding message", e);
    }
  }

  async subscribe(
    pubsubTopic: PubsubTopic,
    peer: Peer,
    contentTopics: ContentTopic[]
  ): Promise<void> {
    const stream = await this.getStream(peer);
    if (!stream) {
      throw new Error(`Failed to get stream for peer ${peer.id.toString()}`);
    }

    const request = FilterSubscribeRpc.createSubscribeRequest(
      pubsubTopic,
      contentTopics
    );

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
        `Filter subscribe request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
      );
    }
  }

  async unsubscribe(
    pubsubTopic: PubsubTopic,
    peer: Peer,
    contentTopics: ContentTopic[]
  ): Promise<void> {
    const stream = await this.getStream(peer);
    if (!stream) {
      throw new Error(`Failed to get stream for peer ${peer.id.toString()}`);
    }

    const unsubscribeRequest = FilterSubscribeRpc.createUnsubscribeRequest(
      pubsubTopic,
      contentTopics
    );

    await pipe([unsubscribeRequest.encode()], lp.encode, stream.sink);
  }

  async unsubscribeAll(pubsubTopic: PubsubTopic, peer: Peer): Promise<void> {
    const stream = await this.getStream(peer);
    if (!stream) {
      throw new Error(`Failed to get stream for peer ${peer.id.toString()}`);
    }

    const request = FilterSubscribeRpc.createUnsubscribeAllRequest(pubsubTopic);

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
  }

  async ping(peer: Peer): Promise<void> {
    const stream = await this.getStream(peer);
    if (!stream) {
      throw new Error(`Failed to get stream for peer ${peer.id.toString()}`);
    }

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
      log.info(`Ping successful for peer ${peer.id.toString()}`);
    } catch (error) {
      log.error("Error pinging: ", error);
      throw error; // Rethrow the actual error instead of wrapping it
    }
  }
}
