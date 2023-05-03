import type { Libp2p } from "@libp2p/interface-libp2p";
import { PeerId } from "@libp2p/interface-peer-id";
import type { Peer } from "@libp2p/interface-peer-store";
import type { IncomingStreamData } from "@libp2p/interface-registrar";
import type {
  ActiveSubscriptions,
  Callback,
  IDecodedMessage,
  IDecoder,
  IFilterV2,
  IProtoMessage,
  ProtocolCreateOptions,
  ProtocolOptions,
  SubscriptionReturn,
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { removeItemFromArray } from "@waku/utils";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { BaseProtocol } from "../../base_protocol.js";
import { DefaultPubSubTopic } from "../../constants.js";
import { groupByContentTopic } from "../../group_by.js";

import {
  FilterPushRpc,
  FilterSubscribeResponse,
  FilterSubscribeRpc,
} from "./filter_rpc.js";

const log = debug("waku:filter:v2");

type Subscription<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
  pubSubTopic: string;
};

const FilterV2Codecs = {
  SUBSCRIBE: "/vac/waku/filter-subscribe/2.0.0-beta1",
  PUSH: "/vac/waku/filter-push/2.0.0-beta1",
};

/**
 * Implements client side of the [Waku v2 Filter protocol](https://rfc.vac.dev/spec/12/).
 *
 * Note this currently only works in NodeJS when the Waku node is listening on a port, see:
 * - https://github.com/status-im/go-waku/issues/245
 * - https://github.com/status-im/nwaku/issues/948
 */
class FilterV2 extends BaseProtocol implements IFilterV2 {
  options: ProtocolCreateOptions;
  private subscriptions: Map<PeerId, unknown[]>;
  public pubSubTopic: string;

  constructor(public libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(
      FilterV2Codecs.SUBSCRIBE,
      libp2p.peerStore,
      libp2p.getConnections.bind(libp2p)
    );

    this.libp2p.handle(FilterV2Codecs.PUSH, this.onRequest.bind(this));

    this.options = options ?? {};
    this.subscriptions = new Map();

    const { pubSubTopic = DefaultPubSubTopic } = this.options;
    this.pubSubTopic = pubSubTopic;
  }

  /**
   * @param decoders Decoder or array of Decoders to use to decode messages, it also specifies the content topics.
   * @param callback A function that will be called on each message returned by the filter.
   * @param opts The FilterSubscriptionOpts used to narrow which messages are returned, and which peer to connect to.
   * @returns Unsubscribe function that can be used to end the subscription.
   */
  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ): Promise<SubscriptionReturn<"v2">> {
    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];

    const contentTopics = Array.from(groupByContentTopic(decodersArray).keys());

    const request = FilterSubscribeRpc.createSubscribeRequest(
      this.pubSubTopic,
      contentTopics
    );

    const peer = await this.getPeer(opts?.peerId);
    const stream = await this.newStream(peer);

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => await all(source)
      );

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(
          `Filter subscribe request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
        );
      }

      log(
        "Subscribed to peer ",
        peer.id.toString(),
        "for content topics",
        contentTopics
      );
    } catch (e) {
      throw new Error(
        "Error subscribing to peer: " +
          peer.id.toString() +
          " for content topics: " +
          contentTopics +
          ": " +
          e
      );
    }

    const subscription: Subscription<T> = {
      callback,
      decoders: decodersArray,
      pubSubTopic: this.pubSubTopic,
    };
    this.subscriptions.get(peer.id)?.push(subscription) ?? [subscription];

    return {
      ping: async () => {
        await this.ping(peer.id);
      },
      unsubscribe: async () => {
        await this.unsubscribe(
          this.pubSubTopic,
          contentTopics,
          peer,
          subscription
        );
      },
      unsubscribeAll: async () => {
        await this.unsubscribeAll(peer);
      },
    };
  }

  private async unsubscribe<T extends IDecodedMessage>(
    topic: string,
    contentTopics: string[],
    peer: Peer,
    subscription: Subscription<T>
  ): Promise<void> {
    const unsubscribeRequest = FilterSubscribeRpc.createUnsubscribeRequest(
      topic,
      contentTopics
    );

    const stream = await this.newStream(peer);
    try {
      await pipe([unsubscribeRequest.encode()], lp.encode(), stream.sink);
    } catch (error) {
      throw new Error("Error subscribing: " + error);
    }

    const subs = this.subscriptions.set(
      peer.id,
      removeItemFromArray(this.subscriptions.get(peer.id) ?? [], subscription)
    );
    if (!subs.get(peer.id)?.length) {
      this.subscriptions.delete(peer.id);
    }
  }

  public async unsubscribeAll(peer: Peer): Promise<void> {
    const request = FilterSubscribeRpc.createUnsubscribeAllRequest(
      this.pubSubTopic
    );

    const stream = await this.newStream(peer);

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => await all(source)
      );

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(
          `Filter unsubscribe all request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
        );
      }

      log("Unsubscribed from all content topics");
    } catch (error) {
      throw new Error("Error unsubscribing from all content topics: " + error);
    }
  }

  public async ping(peerId: PeerId): Promise<void> {
    const request = FilterSubscribeRpc.createSubscriberPingRequest();

    const peer = await this.getPeer(peerId);
    const stream = await this.newStream(peer);

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => await all(source)
      );

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(
          `Filter ping request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
        );
      }

      log("Ping successful");
    } catch (error) {
      log("Error pinging: ", error);
      throw error;
    }
  }

  public getActiveSubscriptions(): ActiveSubscriptions {
    const map: ActiveSubscriptions = new Map();
    const subscriptions = this.subscriptions as Map<
      PeerId,
      Subscription<IDecodedMessage>[]
    >;

    for (const items of subscriptions.values()) {
      for (const item of items) {
        const values = map.get(item.pubSubTopic) || [];
        const nextValues = item.decoders.map((decoder) => decoder.contentTopic);
        map.set(item.pubSubTopic, [...values, ...nextValues]);
      }
    }

    return map;
  }

  private onRequest(streamData: IncomingStreamData): void {
    log("Receiving message push");
    try {
      pipe(streamData.stream, lp.decode(), async (source) => {
        for await (const bytes of source) {
          const response = FilterPushRpc.decode(bytes.slice());

          const { pubsubTopic, wakuMessage } = response;

          if (!wakuMessage) {
            log("Received empty message");
            return;
          }

          const subs = this.subscriptions as Map<
            PeerId,
            Subscription<IDecodedMessage>[]
          >;

          const subscription = subs
            .get(streamData.connection.remotePeer)
            ?.find((s) => {
              s.pubSubTopic === pubsubTopic;
            });

          if (!subscription) {
            log(`No subscription locally registered for topic ${pubsubTopic}`);
            return;
          }

          await this.pushMessage(subscription, wakuMessage);
        }
      }).then(
        () => {
          log("Receiving pipe closed.");
        },
        (e) => {
          log("Error with receiving pipe", e);
        }
      );
    } catch (e) {
      log("Error decoding message", e);
    }
  }

  private async pushMessage<T extends IDecodedMessage>(
    subscription: Subscription<T>,
    message: WakuMessage
  ): Promise<void> {
    const { decoders, callback, pubSubTopic } = subscription;

    if (!decoders || !decoders.length) {
      log(`No decoder registered`);
      return;
    }

    const { contentTopic } = message;
    if (!contentTopic) {
      log("Message has no content topic, skipping");
      return;
    }

    let didDecodeMsg = false;
    // We don't want to wait for decoding failure, just attempt to decode
    // all messages and do the call back on the one that works
    // noinspection ES6MissingAwait
    decoders.forEach(async (dec: IDecoder<T>) => {
      if (didDecodeMsg) return;
      const decoded = await dec.fromProtoObj(
        pubSubTopic,
        message as IProtoMessage
      );
      // const decoded = await dec.fromProtoObj(pubSubTopic, message);
      if (!decoded) {
        log("Not able to decode message");
        return;
      }
      // This is just to prevent more decoding attempt
      // TODO: Could be better if we were to abort promises
      didDecodeMsg = Boolean(decoded);
      await callback(decoded);
    });
  }
}

export function wakuFilterV2(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => IFilterV2 {
  return (libp2p: Libp2p) => new FilterV2(libp2p, init);
}
