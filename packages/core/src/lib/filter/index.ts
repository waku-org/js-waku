import type { IncomingStreamData } from "@libp2p/interface-internal/registrar";
import type {
  IAsyncIterator,
  IDecodedMessage,
  IDecoder,
  IFilter,
  IReceiver,
  Libp2p,
  PeerIdStr,
  ProtocolCreateOptions,
  PubsubTopic,
  Unsubscribe
} from "@waku/interfaces";
import {
  ensurePubsubTopicIsConfigured,
  groupByContentTopic,
  toAsyncIterator
} from "@waku/utils";
import { Logger } from "@waku/utils";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { BaseProtocol } from "../base_protocol.js";
import { DefaultPubsubTopic } from "../constants.js";

import { FilterPushRpc } from "./filter_rpc.js";
import { Subscription } from "./subscription.js";

const log = new Logger("waku:filter-v2");

export const FilterCodecs = {
  SUBSCRIBE: "/vac/waku/filter-subscribe/2.0.0-beta1",
  PUSH: "/vac/waku/filter-push/2.0.0-beta1"
};

class Filter extends BaseProtocol implements IReceiver {
  private readonly pubsubTopics: PubsubTopic[] = [];
  private activeSubscriptions = new Map<string, Subscription>();
  private readonly NUM_PEERS_PROTOCOL = 1;

  private getActiveSubscription(
    pubsubTopic: PubsubTopic,
    peerIdStr: PeerIdStr
  ): Subscription | undefined {
    return this.activeSubscriptions.get(`${pubsubTopic}_${peerIdStr}`);
  }

  private setActiveSubscription(
    pubsubTopic: PubsubTopic,
    peerIdStr: PeerIdStr,
    subscription: Subscription
  ): Subscription {
    this.activeSubscriptions.set(`${pubsubTopic}_${peerIdStr}`, subscription);
    return subscription;
  }

  constructor(libp2p: Libp2p, options?: ProtocolCreateOptions) {
    super(FilterCodecs.SUBSCRIBE, libp2p.components);

    this.pubsubTopics = options?.pubsubTopics || [DefaultPubsubTopic];

    libp2p.handle(FilterCodecs.PUSH, this.onRequest.bind(this)).catch((e) => {
      log.error("Failed to register ", FilterCodecs.PUSH, e);
    });

    this.activeSubscriptions = new Map();
  }

  async createSubscription(
    decoders: IDecoder<IDecodedMessage>[]
  ): Promise<Subscription> {
    const uniquePubsubTopics = new Set(
      decoders.map((decoder) => decoder.pubsubTopic)
    );
    if (uniquePubsubTopics.size > 1) {
      throw new Error(
        "Error: Only one pubsub topic is supported per subscription at this time. Please call this function multiple times if you need to subscribe to multiple topics."
      );
    }
    const pubsubTopic = Array.from(uniquePubsubTopics)[0];
    ensurePubsubTopicIsConfigured(pubsubTopic, this.pubsubTopics);

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
        new Subscription(
          pubsubTopic,
          peer,
          this.getStream.bind(this, peer),
          decoders
        )
      );

    try {
      await subscription.subscribe(decoders);
    } catch (error) {
      throw new Error("Error subscribing: " + error);
    }

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
    decoders: IDecoder<T> | IDecoder<T>[]
  ): Promise<Unsubscribe> {
    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];

    const subscription = await this.createSubscription(decodersArray);

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
    try {
      pipe(streamData.stream, lp.decode, async (source) => {
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

          const peerIdStr = streamData.connection.remotePeer.toString();
          const subscription = this.getActiveSubscription(
            pubsubTopic,
            peerIdStr
          );

          if (!subscription) {
            log.error(
              `No subscription locally registered for topic ${pubsubTopic}`
            );
            return;
          }

          await subscription.processMessage(wakuMessage);
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
}

export function wakuFilter(
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => IFilter {
  return (libp2p: Libp2p) => new Filter(libp2p, init);
}
