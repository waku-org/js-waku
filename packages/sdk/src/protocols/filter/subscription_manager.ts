import type { Peer, PeerId } from "@libp2p/interface";
import { ConnectionManager, FilterCore } from "@waku/core";
import {
  Callback,
  ContentTopic,
  CoreProtocolResult,
  EConnectionStateEvents,
  IDecodedMessage,
  IDecoder,
  IProtoMessage,
  ISubscriptionSDK,
  ProtocolError,
  PubsubTopic,
  SDKProtocolResult,
  SubscribeOptions,
  SubscriptionCallback
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { groupByContentTopic, Logger } from "@waku/utils";

export const DEFAULT_MAX_PINGS = 2;
export const DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD = 3;
export const DEFAULT_KEEP_ALIVE = 60 * 1000;

const log = new Logger("sdk:filter:subscription_manager");

export class SubscriptionManager implements ISubscriptionSDK {
  private subscriptionCallbacks: Map<
    ContentTopic,
    SubscriptionCallback<IDecodedMessage>
  > = new Map();
  private peerFailures: Map<string, number> = new Map();

  private keepAliveInterval: number = DEFAULT_KEEP_ALIVE;
  private maxPingFailures: number = DEFAULT_MAX_PINGS;

  private keepAliveTimer: number | null = null;

  public constructor(
    public readonly pubsubTopic: PubsubTopic,
    private readonly protocol: FilterCore,
    private readonly connectionManager: ConnectionManager,
    private readonly getPeers: () => Peer[],
    private readonly renewPeer: (peerToDisconnect: PeerId) => Promise<Peer>
  ) {
    this.pubsubTopic = pubsubTopic;
  }

  public async subscribe<T extends IDecodedMessage>(
    decoders: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>,
    options: SubscribeOptions = {}
  ): Promise<SDKProtocolResult> {
    this.keepAliveInterval = options.keepAlive || DEFAULT_KEEP_ALIVE;
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

    this.startSubscriptionsMaintenance(this.keepAliveInterval);

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
      this.stopSubscriptionsMaintenance();
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

    this.stopSubscriptionsMaintenance();

    return finalResult;
  }

  public async processIncomingMessage(message: WakuMessage): Promise<void> {
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
        await this.renewAndSubscribePeer(peerId);
        this.peerFailures.delete(peerId.toString());
      } catch (error) {
        log.error(`Failed to renew peer ${peerId.toString()}: ${error}.`);
      }
    }
  }

  public async renewAndSubscribePeer(
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
      log.warn(`Failed to renew peer ${peerId.toString()}: ${error}.`);
      return;
    } finally {
      this.peerFailures.delete(peerId.toString());
    }
  }

  private startSubscriptionsMaintenance(interval: number): void {
    this.startKeepAlivePings(interval);
    this.startConnectionListener();
  }

  private stopSubscriptionsMaintenance(): void {
    this.stopKeepAlivePings();
    this.stopConnectionListener();
  }

  private startKeepAlivePings(interval: number): void {
    if (this.keepAliveTimer) {
      log.info("Recurring pings already set up.");
      return;
    }

    this.keepAliveTimer = setInterval(() => {
      void this.ping().catch((error) => {
        log.error("Error in keep-alive ping cycle:", error);
      });
    }, interval) as unknown as number;
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

  private startConnectionListener(): void {
    this.connectionManager.addEventListener(
      EConnectionStateEvents.CONNECTION_STATUS,
      this.connectionListener.bind(this) as (v: CustomEvent<boolean>) => void
    );
  }

  private stopConnectionListener(): void {
    this.connectionManager.removeEventListener(
      EConnectionStateEvents.CONNECTION_STATUS,
      this.connectionListener.bind(this) as (v: CustomEvent<boolean>) => void
    );
  }

  private async connectionListener({
    detail: isConnected
  }: CustomEvent<boolean>): Promise<void> {
    if (!isConnected) {
      this.stopKeepAlivePings();
      return;
    }

    try {
      const result = await this.ping();
      const renewPeerPromises = result.failures.map(
        async (v): Promise<void> => {
          if (v.peerId) {
            await this.renewAndSubscribePeer(v.peerId);
          }
        }
      );

      await Promise.all(renewPeerPromises);
    } catch (err) {
      log.error(`networkStateListener failed to recover: ${err}`);
    }

    this.startKeepAlivePings(this.keepAliveInterval);
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
