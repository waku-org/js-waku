import type { PeerId, Stream } from "@libp2p/interface";
import type { IncomingStreamData } from "@libp2p/interface-internal";
import {
  type ContentTopic,
  type CoreProtocolResult,
  type Libp2p,
  ProtocolError,
  type PubsubTopic
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { StreamManager } from "../stream_manager/index.js";

import {
  FilterPushRpc,
  FilterSubscribeResponse,
  FilterSubscribeRpc
} from "./filter_rpc.js";

const log = new Logger("filter-core");

export const FilterCodecs = {
  SUBSCRIBE: "/vac/waku/filter-subscribe/2.0.0-beta1",
  PUSH: "/vac/waku/filter-push/2.0.0-beta1"
};

type IncomingMessageHandler = (
  pubsubTopic: PubsubTopic,
  wakuMessage: WakuMessage,
  peerIdStr: string
) => Promise<void>;

export class FilterCore {
  public readonly multicodec = FilterCodecs.SUBSCRIBE;
  public readonly pubsubTopics: PubsubTopic[];

  public constructor(
    private handleIncomingMessage: IncomingMessageHandler,
    pubsubTopics: PubsubTopic[],
    libp2p: Libp2p
  ) {
    this.pubsubTopics = pubsubTopics;
    this.streamManager = new StreamManager(
      FilterCodecs.SUBSCRIBE,
      libp2p.components
    );

    libp2p
      .handle(FilterCodecs.PUSH, this.onRequest.bind(this), {
        maxInboundStreams: 100
      })
      .catch((e) => {
        log.error("Failed to register ", FilterCodecs.PUSH, e);
      });
  }

  public async subscribe(
    pubsubTopic: PubsubTopic,
    peerId: PeerId,
    contentTopics: ContentTopic[]
  ): Promise<CoreProtocolResult> {
    const stream = await this.streamManager.getStream(peerId);

    const request = FilterSubscribeRpc.createSubscribeRequest(
      pubsubTopic,
      contentTopics
    );

    let res: Uint8ArrayList[] | undefined;
    try {
      res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );

      if (!res?.length) {
        throw Error("Received no response from subscription request.");
      }
    } catch (error) {
      log.error("Failed to send subscribe request", error);
      return {
        success: null,
        failure: {
          error: ProtocolError.GENERIC_FAIL,
          peerId: peerId
        }
      };
    }

    const { statusCode, requestId, statusDesc } =
      FilterSubscribeResponse.decode(res[0].slice());

    if (statusCode < 200 || statusCode >= 300) {
      log.error(
        `Filter subscribe request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
      );
      return {
        failure: {
          error: ProtocolError.REMOTE_PEER_REJECTED,
          peerId: peerId
        },
        success: null
      };
    }

    return {
      failure: null,
      success: peerId
    };
  }

  public async unsubscribe(
    pubsubTopic: PubsubTopic,
    peerId: PeerId,
    contentTopics: ContentTopic[]
  ): Promise<CoreProtocolResult> {
    let stream: Stream | undefined;
    try {
      stream = await this.streamManager.getStream(peerId);
    } catch (error) {
      log.error(
        `Failed to get a stream for remote peer${peerId.toString()}`,
        error
      );
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_STREAM_AVAILABLE,
          peerId: peerId
        }
      };
    }

    const unsubscribeRequest = FilterSubscribeRpc.createUnsubscribeRequest(
      pubsubTopic,
      contentTopics
    );

    try {
      await pipe([unsubscribeRequest.encode()], lp.encode, stream.sink);
    } catch (error) {
      log.error("Failed to send unsubscribe request", error);
      return {
        success: null,
        failure: {
          error: ProtocolError.GENERIC_FAIL,
          peerId: peerId
        }
      };
    }

    return {
      success: peerId,
      failure: null
    };
  }

  public async unsubscribeAll(
    pubsubTopic: PubsubTopic,
    peerId: PeerId
  ): Promise<CoreProtocolResult> {
    const stream = await this.streamManager.getStream(peerId);

    const request = FilterSubscribeRpc.createUnsubscribeAllRequest(pubsubTopic);

    const res = await pipe(
      [request.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    if (!res || !res.length) {
      return {
        failure: {
          error: ProtocolError.NO_RESPONSE,
          peerId: peerId
        },
        success: null
      };
    }

    const { statusCode, requestId, statusDesc } =
      FilterSubscribeResponse.decode(res[0].slice());

    if (statusCode < 200 || statusCode >= 300) {
      log.error(
        `Filter unsubscribe all request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
      );
      return {
        failure: {
          error: ProtocolError.REMOTE_PEER_REJECTED,
          peerId: peerId
        },
        success: null
      };
    }

    return {
      failure: null,
      success: peerId
    };
  }

  public async ping(peerId: PeerId): Promise<CoreProtocolResult> {
    let stream: Stream | undefined;
    try {
      stream = await this.streamManager.getStream(peerId);
    } catch (error) {
      log.error(
        `Failed to get a stream for remote peer${peerId.toString()}`,
        error
      );
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_STREAM_AVAILABLE,
          peerId: peerId
        }
      };
    }

    const request = FilterSubscribeRpc.createSubscriberPingRequest();

    let res: Uint8ArrayList[] | undefined;
    try {
      res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );
    } catch (error) {
      log.error("Failed to send ping request", error);
      return {
        success: null,
        failure: {
          error: ProtocolError.GENERIC_FAIL,
          peerId: peerId
        }
      };
    }

    if (!res || !res.length) {
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_RESPONSE,
          peerId: peerId
        }
      };
    }

    const { statusCode, requestId, statusDesc } =
      FilterSubscribeResponse.decode(res[0].slice());

    if (statusCode < 200 || statusCode >= 300) {
      log.error(
        `Filter ping request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
      );
      return {
        success: null,
        failure: {
          error: ProtocolError.REMOTE_PEER_REJECTED,
          peerId: peerId
        }
      };
    }
    return {
      success: peerId,
      failure: null
    };
  }

  private streamManager: StreamManager;
  private handleIncomingMessage: IncomingMessageHandler;

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

          await this.handleIncomingMessage(
            pubsubTopic,
            wakuMessage,
            connection.remotePeer.toString()
          );
        }
      }).then(
        () => {
          log.info("Receiving pipe closed.");
        },
        async (e) => {
          log.error(
            `Error with receiving pipe on peer:${connection.remotePeer.toString()} -- stream:${stream.id} -- protocol:${stream.protocol}: `,
            e
          );
        }
      );
    } catch (e) {
      log.error("Error decoding message", e);
    }
  }
}
