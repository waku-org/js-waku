import type { Peer, PeerId } from "@libp2p/interface";
import { FilterCore } from "@waku/core";
import {
  type Callback,
  type ContentTopic,
  type CoreProtocolResult,
  type IDecodedMessage,
  type IDecoder,
  type IProtoMessage,
  type ISubscriptionSDK,
  type PeerIdStr,
  ProtocolError,
  type PubsubTopic,
  type SDKProtocolResult,
  type SubscribeOptions
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { groupByContentTopic, Logger } from "@waku/utils";

import { FilterReliabilityMonitor as ReliabilityMonitor } from "../reliability_monitor";

import { DEFAULT_KEEP_ALIVE, DEFAULT_SUBSCRIBE_OPTIONS } from "./constants";

type SubscriptionCallback<T extends IDecodedMessage> = {
  decoders: IDecoder<T>[];
  callback: Callback<T>;
};

const DEFAULT_MAX_PINGS = 3;

const log = new Logger("sdk:filter:subscription_manager");

export class SubscriptionManager implements ISubscriptionSDK {
  private keepAliveTimer: number | null = null;
  private peerFailures: Map<string, number> = new Map();
  private maxPingFailures: number = DEFAULT_MAX_PINGS;
  private reliabilityMonitor: ReliabilityMonitor;

  private subscriptionCallbacks: Map<
    ContentTopic,
    SubscriptionCallback<IDecodedMessage>
  >;

  public constructor(
    private readonly pubsubTopic: PubsubTopic,
    private protocol: FilterCore,
    private getPeers: () => Peer[],
    private readonly renewPeer: (peerToDisconnect: PeerId) => Promise<Peer>
  ) {
    this.pubsubTopic = pubsubTopic;
    this.subscriptionCallbacks = new Map();
    this.reliabilityMonitor = new ReliabilityMonitor(
      this.renewAndSubscribePeer
    );
  }

  public async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    options: SubscribeOptions = DEFAULT_SUBSCRIBE_OPTIONS
  ): Promise<SDKProtocolResult> {
    this.keepAliveTimer = options.keepAlive || DEFAULT_KEEP_ALIVE;
    this.maxPingFailures = options.pingsBeforePeerRenewed || DEFAULT_MAX_PINGS;

    const decodersArray = Array.isArray(decoders) ? decoders : [decoders];

    // check that all decoders are configured for the same pubsub topic as this subscription
    for (const decoder of decodersArray) {
      if (decoder.pubsubTopic !== this.pubsubTopic) {
        return {
          failures: [
            {
              error: ProtocolError.TOPIC_DECODER_MISMATCH
            }
          ],
          successes: []
        };
      }
    }

    const decodersGroupedByCT = groupByContentTopic(decodersArray);
    const contentTopics = Array.from(decodersGroupedByCT.keys());

    const promises = this.getPeers().map(async (peer) =>
      this.protocol.subscribe(this.pubsubTopic, peer, contentTopics)
    );

    const results = await Promise.allSettled(promises);

    const finalResult = this.handleResult(results, "subscribe");

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

    if (options.keepAlive) {
      this.startKeepAlivePings(options);
    }

    return finalResult;
  }

  public async unsubscribe(
    contentTopics: ContentTopic[]
  ): Promise<SDKProtocolResult> {
    const promises = this.getPeers().map(async (peer) => {
      const response = await this.protocol.unsubscribe(
        this.pubsubTopic,
        peer,
        contentTopics
      );

      contentTopics.forEach((contentTopic: string) => {
        this.subscriptionCallbacks.delete(contentTopic);
      });

      return response;
    });

    const results = await Promise.allSettled(promises);
    const finalResult = this.handleResult(results, "unsubscribe");

    if (this.subscriptionCallbacks.size === 0) {
      if (this.keepAliveTimer) {
        this.stopKeepAlivePings();
      }
    }

    return finalResult;
  }

  public async ping(peerId?: PeerId): Promise<SDKProtocolResult> {
    const peers = peerId ? [peerId] : this.getPeers().map((peer) => peer.id);

    const promises = peers.map((peerId) => this.pingSpecificPeer(peerId));
    const results = await Promise.allSettled(promises);

    return this.handleResult(results, "ping");
  }

  public async unsubscribeAll(): Promise<SDKProtocolResult> {
    const promises = this.getPeers().map(async (peer) =>
      this.protocol.unsubscribeAll(this.pubsubTopic, peer)
    );

    const results = await Promise.allSettled(promises);

    this.subscriptionCallbacks.clear();

    const finalResult = this.handleResult(results, "unsubscribeAll");

    if (this.keepAliveTimer) {
      this.stopKeepAlivePings();
    }

    return finalResult;
  }

  public async processIncomingMessage(
    message: WakuMessage,
    peerIdStr: PeerIdStr
  ): Promise<void> {
    await this.reliabilityMonitor.processAndValidateMessage(
      message,
      this.pubsubTopic,
      peerIdStr,
      this.getPeers
    );

    const { contentTopic } = message;
    const subscriptionCallback = this.subscriptionCallbacks.get(contentTopic);
    if (!subscriptionCallback) {
      log.error("No subscription callback available for ", contentTopic);
      return;
    }
    log.info(
      "Processing message with content topic ",
      contentTopic,
      " on pubsub topic ",
      this.pubsubTopic
    );
    await pushMessage(subscriptionCallback, this.pubsubTopic, message);
  }

  private handleResult(
    results: PromiseSettledResult<CoreProtocolResult>[],
    type: "ping" | "subscribe" | "unsubscribe" | "unsubscribeAll"
  ): SDKProtocolResult {
    const result: SDKProtocolResult = { failures: [], successes: [] };

    for (const promiseResult of results) {
      if (promiseResult.status === "rejected") {
        log.error(
          `Failed to resolve ${type} promise successfully: `,
          promiseResult.reason
        );
        result.failures.push({ error: ProtocolError.GENERIC_FAIL });
      } else {
        const coreResult = promiseResult.value;
        if (coreResult.failure) {
          result.failures.push(coreResult.failure);
        } else {
          result.successes.push(coreResult.success);
        }
      }
    }
    return result;
  }

  private async pingSpecificPeer(peerId: PeerId): Promise<CoreProtocolResult> {
    const peer = this.getPeers().find((p) => p.id.equals(peerId));
    if (!peer) {
      return {
        success: null,
        failure: {
          peerId,
          error: ProtocolError.NO_PEER_AVAILABLE
        }
      };
    }

    try {
      const result = await this.protocol.ping(peer);
      if (result.failure) {
        await this.handlePeerFailure(peerId);
      } else {
        this.peerFailures.delete(peerId.toString());
      }
      return result;
    } catch (error) {
      await this.handlePeerFailure(peerId);
      return {
        success: null,
        failure: {
          peerId,
          error: ProtocolError.GENERIC_FAIL
        }
      };
    }
  }

  private async handlePeerFailure(peerId: PeerId): Promise<void> {
    const failures = (this.peerFailures.get(peerId.toString()) || 0) + 1;
    this.peerFailures.set(peerId.toString(), failures);

    if (failures > this.maxPingFailures) {
      try {
        const newPeer = await this.renewAndSubscribePeer(peerId);
        if (newPeer) {
          this.peerFailures.delete(peerId.toString());
          this.reliabilityMonitor.resetPeer(peerId.toString());
          this.reliabilityMonitor.resetPeer(newPeer.id.toString());
        }
      } catch (error) {
        log.error(
          `Failed to renew and subscribe peer ${peerId.toString()}: ${error}.`
        );
      }
    }
  }

  private async renewAndSubscribePeer(
    peerId: PeerId
  ): Promise<Peer | undefined> {
    try {
      const newPeer = await this.renewPeer(peerId);
      await this.protocol.subscribe(
        this.pubsubTopic,
        newPeer,
        Array.from(this.subscriptionCallbacks.keys())
      );
      return newPeer;
    } catch (error) {
      log.warn(
        `Failed to renew and subscribe peer ${peerId.toString()}: ${error}.`
      );
      return undefined;
    }
  }

  private startKeepAlivePings(options: SubscribeOptions): void {
    const { keepAlive } = options;
    if (this.keepAliveTimer) {
      log.info("Recurring pings already set up.");
      return;
    }

    this.keepAliveTimer = setInterval(() => {
      void this.ping().catch((error) => {
        log.error("Error in keep-alive ping cycle:", error);
      });
    }, keepAlive) as unknown as number;
  }

  private stopKeepAlivePings(): void {
    if (!this.keepAliveTimer) {
      log.info("Already stopped recurring pings.");
      return;
    }

    log.info("Stopping recurring pings.");
    clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = null;
  }
}

async function pushMessage<T extends IDecodedMessage>(
  subscriptionCallback: SubscriptionCallback<T>,
  pubsubTopic: PubsubTopic,
  message: WakuMessage
): Promise<void> {
  const { decoders, callback } = subscriptionCallback;

  const { contentTopic } = message;
  if (!contentTopic) {
    log.warn("Message has no content topic, skipping");
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
    log.error("Error decoding message", e);
  }
}
