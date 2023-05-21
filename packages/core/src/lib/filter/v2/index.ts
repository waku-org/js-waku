import { Stream } from "@libp2p/interface-connection";
import type { Libp2p } from "@libp2p/interface-libp2p";
import { PeerId } from "@libp2p/interface-peer-id";
import type { Peer } from "@libp2p/interface-peer-store";
import type { IncomingStreamData } from "@libp2p/interface-registrar";
import type {
  Callback,
  ContentTopic,
  ErrorResult,
  IAsyncIterator,
  IDecodedMessage,
  IDecoder,
  IFilterV2,
  IProtoMessage,
  IReceiver,
  PeerIdStr,
  PeerSubscription,
  ProtocolCreateOptions,
  ProtocolOptions,
  SubscriptionsLog,
  Unsubscribe,
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { groupByContentTopic, toAsyncIterator } from "@waku/utils";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { BaseProtocol } from "../../base_protocol.js";
import { DefaultPubSubTopic } from "../../constants.js";

import {
  FilterPushRpc,
  FilterSubscribeResponse,
  FilterSubscribeRpc,
} from "./filter_rpc.js";

const log = debug("waku:filter:v2");

const FilterV2Codecs = {
  SUBSCRIBE: "/vac/waku/filter-subscribe/2.0.0-beta1",
  PUSH: "/vac/waku/filter-push/2.0.0-beta1",
};

class Subscription {
  private readonly peer: Peer;
  private readonly pubSubTopic: string;

  private newStream: (peer: Peer) => Promise<Stream>;

  constructor(
    pubSubTopic: string,
    remotePeer: Peer,
    newStream: (peer: Peer) => Promise<Stream>
  ) {
    this.peer = remotePeer;
    this.pubSubTopic = pubSubTopic;
    this.newStream = newStream;
  }

  //TODO: fix return value
  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<ErrorResult> {
    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];
    const contentTopics = Array.from(groupByContentTopic(decodersArray).keys());

    const stream = await this.newStream(this.peer);

    const request = FilterSubscribeRpc.createSubscribeRequest(
      this.pubSubTopic,
      contentTopics
    );

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
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
        this.peer.id.toString(),
        "for content topics",
        contentTopics
      );
    } catch (e) {
      throw new Error(
        "Error subscribing to peer: " +
          this.peer.id.toString() +
          " for content topics: " +
          contentTopics +
          ": " +
          e
      );
    }

    const subscription: PeerSubscription<T> = {
      callback,
      decoders: decodersArray,
      pubSubTopic: this.pubSubTopic,
    };
    FilterV2.subscriptionsLog.set(
      this.peer.id.toString(),
      [
        ...(FilterV2.subscriptionsLog.get(this.peer.id.toString()) ?? []),
        subscription,
      ] ?? [subscription]
    );

    return { error: false };
  }

  //TODO: fix return value
  async unsubscribe(contentTopics: ContentTopic[]): Promise<ErrorResult> {
    const stream = await this.newStream(this.peer);
    const unsubscribeRequest = FilterSubscribeRpc.createUnsubscribeRequest(
      this.pubSubTopic,
      contentTopics
    );

    try {
      await pipe([unsubscribeRequest.encode()], lp.encode, stream.sink);
    } catch (error) {
      throw new Error("Error subscribing: " + error);
    }

    return { error: false };
  }

  //TODO: fix return value
  async ping(): Promise<ErrorResult> {
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
      throw new Error("Error pinging: " + error);
    }

    return { error: false };
  }

  async unsubscribeAll(): Promise<ErrorResult> {
    const stream = await this.newStream(this.peer);

    const request = FilterSubscribeRpc.createUnsubscribeAllRequest(
      this.pubSubTopic
    );

    try {
      const res = await pipe(
        [request.encode()],
        lp.encode,
        stream,
        lp.decode,
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

    return { error: false };
  }
}

class FilterV2 extends BaseProtocol implements IReceiver {
  private readonly options: ProtocolCreateOptions;
  static subscriptionsLog: SubscriptionsLog = new Map();

  constructor(public libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(
      FilterV2Codecs.SUBSCRIBE,
      libp2p.peerStore,
      libp2p.getConnections.bind(libp2p)
    );

    this.libp2p.handle(FilterV2Codecs.PUSH, this.onRequest.bind(this));

    this.options = options ?? {};
  }

  async createSubscription(
    _pubSubTopic?: string,
    peerId?: PeerId
  ): Promise<Subscription> {
    const pubSubTopic =
      _pubSubTopic ?? this.options.pubSubTopic ?? DefaultPubSubTopic;

    const peer = await this.getPeer(peerId);

    return new Subscription(pubSubTopic, peer, this.newStream.bind(this, peer));
  }

  public toSubscriptionIterator<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    opts?: ProtocolOptions | undefined
  ): Promise<IAsyncIterator<T>> {
    return toAsyncIterator(this, decoders, opts);
  }

  private onRequest(streamData: IncomingStreamData): void {
    log("Receiving message push");
    try {
      pipe(streamData.stream, lp.decode, async (source) => {
        for await (const bytes of source) {
          const response = FilterPushRpc.decode(bytes.slice());

          const { pubsubTopic, wakuMessage } = response;

          if (!wakuMessage) {
            log("Received empty message");
            return;
          }

          const subs = FilterV2.subscriptionsLog as Map<
            PeerIdStr,
            PeerSubscription<IDecodedMessage>[]
          >;
          const subscription = subs
            .get(streamData.connection.remotePeer.toString())
            ?.find((s) => s.pubSubTopic === pubsubTopic);

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
    peerSubscription: PeerSubscription<T>,
    message: WakuMessage
  ): Promise<void> {
    const { decoders, callback, pubSubTopic } = peerSubscription;

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

  // This is to satisfy the `IReceiver` interface, do not use.
  // instead, use `createSubscription` to create a new subscription.
  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ): Promise<Unsubscribe> {
    const subscription = await this.createSubscription(undefined, opts?.peerId);

    subscription.subscribe(decoders, callback);

    const contentTopics = Array.from(
      groupByContentTopic(
        Array.isArray(decoders) ? decoders : [decoders]
      ).keys()
    );

    return async () => {
      await subscription.unsubscribe(contentTopics);
    };
  }
}

export function wakuFilterV2(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => IFilterV2 {
  return (libp2p: Libp2p) => new FilterV2(libp2p, init);
}
