import { Stream } from "@libp2p/interface/connection";
import type { Peer } from "@libp2p/interface/peer-store";
import type { IncomingStreamData } from "@libp2p/interface-internal/registrar";
import type {
  Callback,
  ContentTopic,
  IAsyncIterator,
  IDecodedMessage,
  IDecoder,
  IFilter,
  IProtoMessage,
  IReceiver,
  Libp2p,
  PeerIdStr,
  ProtocolCreateOptions,
  PubSubTopic,
  Unsubscribe
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import {
  ensurePubsubTopicIsConfigured,
  groupByContentTopic,
  toAsyncIterator
} from "@waku/utils";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { BaseProtocol } from "../base_protocol.js";
import { DefaultPubSubTopic } from "../constants.js";

import {
  FilterPushRpc,
  FilterSubscribeResponse,
  FilterSubscribeRpc
} from "./filter_rpc.js";

const log = debug("waku:filter:v2");

type SubscriptionCallback<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
};

export const FilterCodecs = {
  SUBSCRIBE: "/vac/waku/filter-subscribe/2.0.0-beta1",
  PUSH: "/vac/waku/filter-push/2.0.0-beta1"
};

class Subscription {
  private readonly peer: Peer;
  private readonly pubsubTopic: PubSubTopic;
  private newStream: (peer: Peer) => Promise<Stream>;

  private subscriptionCallbacks: Map<
    ContentTopic,
    SubscriptionCallback<IDecodedMessage>
  >;

  constructor(
    pubsubTopic: PubSubTopic,
    remotePeer: Peer,
    newStream: (peer: Peer) => Promise<Stream>
  ) {
    this.peer = remotePeer;
    this.pubsubTopic = pubsubTopic;
    this.newStream = newStream;
    this.subscriptionCallbacks = new Map();
  }

  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<void> {
    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];
    const decodersGroupedByCT = groupByContentTopic(decodersArray);
    const contentTopics = Array.from(decodersGroupedByCT.keys());

    const stream = await this.newStream(this.peer);

    const request = FilterSubscribeRpc.createSubscribeRequest(
      this.pubsubTopic,
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

    // Save the callback functions by content topics so they
    // can easily be removed (reciprocally replaced) if `unsubscribe` (reciprocally `subscribe`)
    // is called for those content topics
    decodersGroupedByCT.forEach((decoders, contentTopic) => {
      // Cast the type because a given `subscriptionCallbacks` map may hold
      // Decoder that decode to different implementations of `IDecodedMessage`
      const subscriptionCallback = {
        decoders,
        callback
      } as unknown as SubscriptionCallback<IDecodedMessage>;

      // The callback and decoder may override previous values, this is on
      // purpose as the user may call `subscribe` to refresh the subscription
      this.subscriptionCallbacks.set(contentTopic, subscriptionCallback);
    });
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
      throw new Error("Error subscribing: " + error);
    }

    contentTopics.forEach((contentTopic: string) => {
      this.subscriptionCallbacks.delete(contentTopic);
    });
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

      const { statusCode, requestId, statusDesc } =
        FilterSubscribeResponse.decode(res[0].slice());

      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(
          `Filter unsubscribe all request ${requestId} failed with status code ${statusCode}: ${statusDesc}`
        );
      }

      this.subscriptionCallbacks.clear();
      log("Unsubscribed from all content topics");
    } catch (error) {
      throw new Error("Error unsubscribing from all content topics: " + error);
    }
  }

  async processMessage(message: WakuMessage): Promise<void> {
    const contentTopic = message.contentTopic;
    const subscriptionCallback = this.subscriptionCallbacks.get(contentTopic);
    if (!subscriptionCallback) {
      log("No subscription callback available for ", contentTopic);
      return;
    }
    await pushMessage(subscriptionCallback, this.pubsubTopic, message);
  }
}

class Filter extends BaseProtocol implements IReceiver {
  private readonly pubSubTopics: PubSubTopic[] = [];
  private activeSubscriptions = new Map<string, Subscription>();
  private readonly NUM_PEERS_PROTOCOL = 1;

  private getActiveSubscription(
    pubsubTopic: PubSubTopic,
    peerIdStr: PeerIdStr
  ): Subscription | undefined {
    return this.activeSubscriptions.get(`${pubsubTopic}_${peerIdStr}`);
  }

  private setActiveSubscription(
    pubsubTopic: PubSubTopic,
    peerIdStr: PeerIdStr,
    subscription: Subscription
  ): Subscription {
    this.activeSubscriptions.set(`${pubsubTopic}_${peerIdStr}`, subscription);
    return subscription;
  }

  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(FilterCodecs.SUBSCRIBE, libp2p.components);

    this.pubSubTopics = options?.pubSubTopics || [DefaultPubSubTopic];

    libp2p.handle(FilterCodecs.PUSH, this.onRequest.bind(this)).catch((e) => {
      log("Failed to register ", FilterCodecs.PUSH, e);
    });

    this.activeSubscriptions = new Map();
  }

  async createSubscription(
    pubsubTopic: string = DefaultPubSubTopic
  ): Promise<Subscription> {
    ensurePubsubTopicIsConfigured(pubsubTopic, this.pubSubTopics);

    //TODO: get a relevant peer for the topic/shard
    // https://github.com/waku-org/js-waku/pull/1586#discussion_r1336428230
    const peer = (
      await this.getPeers({
        maxBootstrapPeers: 1,
        numPeers: this.NUM_PEERS_PROTOCOL
      })
    )[0];

    const subscription =
      this.getActiveSubscription(pubsubTopic, peer.id.toString()) ??
      this.setActiveSubscription(
        pubsubTopic,
        peer.id.toString(),
        new Subscription(pubsubTopic, peer, this.getStream.bind(this, peer))
      );

    return subscription;
  }

  public toSubscriptionIterator<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[]
  ): Promise<IAsyncIterator<T>> {
    return toAsyncIterator(this, decoders);
  }

  /**
   * This method is used to satisfy the `IReceiver` interface.
   *
   * @hidden
   *
   * @param decoders The decoders to use for the subscription.
   * @param callback The callback function to use for the subscription.
   * @param opts Optional protocol options for the subscription.
   *
   * @returns A Promise that resolves to a function that unsubscribes from the subscription.
   *
   * @remarks
   * This method should not be used directly.
   * Instead, use `createSubscription` to create a new subscription.
   */
  async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<Unsubscribe> {
    const subscription = await this.createSubscription();

    await subscription.subscribe(decoders, callback);

    const contentTopics = Array.from(
      groupByContentTopic(
        Array.isArray(decoders) ? decoders : [decoders]
      ).keys()
    );

    return async () => {
      await subscription.unsubscribe(contentTopics);
    };
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

          if (!pubsubTopic) {
            log("PubSub topic missing from push message");
            return;
          }

          const peerIdStr = streamData.connection.remotePeer.toString();
          const subscription = this.getActiveSubscription(
            pubsubTopic,
            peerIdStr
          );

          if (!subscription) {
            log(`No subscription locally registered for topic ${pubsubTopic}`);
            return;
          }

          await subscription.processMessage(wakuMessage);
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
}

export function wakuFilter(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => IFilter {
  return (libp2p: Libp2p) => new Filter(libp2p, init);
}

async function pushMessage<T extends IDecodedMessage>(
  subscriptionCallback: SubscriptionCallback<T>,
  pubsubTopic: PubSubTopic,
  message: WakuMessage
): Promise<void> {
  const { decoders, callback } = subscriptionCallback;

  const { contentTopic } = message;
  if (!contentTopic) {
    log("Message has no content topic, skipping");
    return;
  }

  try {
    const decodePromises = decoders.map((dec) =>
      dec
        .fromProtoObj(pubsubTopic, message as IProtoMessage)
        .then((decoded) => decoded || Promise.reject("Decoding failed"))
    );

    const decodedMessage = await Promise.any(decodePromises);

    await callback(decodedMessage);
  } catch (e) {
    log("Error decoding message", e);
  }
}
