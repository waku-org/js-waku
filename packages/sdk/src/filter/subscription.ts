import {
  type EventHandler,
  type PeerId,
  TypedEventEmitter
} from "@libp2p/interface";
import { FilterCore, messageHashStr } from "@waku/core";
import type {
  Callback,
  FilterProtocolOptions,
  IDecodedMessage,
  IDecoder,
  IProtoMessage,
  PeerIdStr
} from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

import { PeerManager, PeerManagerEventNames } from "../peer_manager/index.js";

import { SubscriptionEvents, SubscriptionParams } from "./types.js";
import { TTLSet } from "./utils.js";

const log = new Logger("sdk:filter-subscription");

type AttemptSubscribeParams = {
  useNewContentTopics: boolean;
  useOnlyNewPeers?: boolean;
};

type AttemptUnsubscribeParams = {
  useNewContentTopics: boolean;
};

type Libp2pEventHandler = (e: CustomEvent<PeerId>) => void;

export class Subscription {
  private readonly pubsubTopic: string;
  private readonly protocol: FilterCore;
  private readonly peerManager: PeerManager;

  private readonly config: FilterProtocolOptions;

  private isStarted: boolean = false;
  private inProgress: boolean = false;

  // Map and Set cannot reliably use PeerId type as a key
  private peers = new Map<PeerIdStr, PeerId>();
  private peerFailures = new Map<PeerIdStr, number>();

  private readonly receivedMessages = new TTLSet<string>(60_000);

  private callbacks = new Map<
    IDecoder<IDecodedMessage>,
    EventHandler<CustomEvent<WakuMessage>>
  >();
  private messageEmitter = new TypedEventEmitter<SubscriptionEvents>();

  private toSubscribeContentTopics = new Set<string>();
  private toUnsubscribeContentTopics = new Set<string>();

  private subscribeIntervalId: number | null = null;
  private keepAliveIntervalId: number | null = null;

  private get contentTopics(): string[] {
    const allTopics = Array.from(this.callbacks.keys()).map(
      (k) => k.contentTopic
    );
    const uniqueTopics = new Set(allTopics).values();

    return Array.from(uniqueTopics);
  }

  public constructor(params: SubscriptionParams) {
    this.config = params.config;
    this.pubsubTopic = params.pubsubTopic;

    this.protocol = params.protocol;
    this.peerManager = params.peerManager;

    this.onPeerConnected = this.onPeerConnected.bind(this);
    this.onPeerDisconnected = this.onPeerDisconnected.bind(this);
  }

  public start(): void {
    log.info(`Starting subscription for pubsubTopic: ${this.pubsubTopic}`);

    if (this.isStarted || this.inProgress) {
      log.info("Subscription already started or in progress, skipping start");
      return;
    }

    this.inProgress = true;

    void this.attemptSubscribe({
      useNewContentTopics: false
    });
    this.setupSubscriptionInterval();
    this.setupKeepAliveInterval();
    this.setupEventListeners();

    this.isStarted = true;
    this.inProgress = false;

    log.info(`Subscription started for pubsubTopic: ${this.pubsubTopic}`);
  }

  public stop(): void {
    log.info(`Stopping subscription for pubsubTopic: ${this.pubsubTopic}`);

    if (!this.isStarted || this.inProgress) {
      log.info("Subscription not started or stop in progress, skipping stop");
      return;
    }

    this.inProgress = true;

    this.disposeEventListeners();
    this.disposeIntervals();
    void this.disposePeers();
    this.disposeHandlers();
    this.receivedMessages.dispose();

    this.inProgress = false;
    this.isStarted = false;

    log.info(`Subscription stopped for pubsubTopic: ${this.pubsubTopic}`);
  }

  public isEmpty(): boolean {
    return this.callbacks.size === 0;
  }

  public async add<T extends IDecodedMessage>(
    decoder: IDecoder<T> | IDecoder<T>[],
    callback: Callback<T>
  ): Promise<boolean> {
    const decoders = Array.isArray(decoder) ? decoder : [decoder];

    for (const decoder of decoders) {
      this.addSingle(decoder, callback);
    }

    return this.toSubscribeContentTopics.size > 0
      ? await this.attemptSubscribe({ useNewContentTopics: true })
      : true; // if content topic is not new - subscription, most likely exists
  }

  public async remove<T extends IDecodedMessage>(
    decoder: IDecoder<T> | IDecoder<T>[]
  ): Promise<boolean> {
    const decoders = Array.isArray(decoder) ? decoder : [decoder];

    for (const decoder of decoders) {
      this.removeSingle(decoder);
    }

    return this.toUnsubscribeContentTopics.size > 0
      ? await this.attemptUnsubscribe({ useNewContentTopics: true })
      : true; // no need to unsubscribe if there are other decoders on the contentTopic
  }

  public invoke(message: WakuMessage, _peerId: string): void {
    if (this.isMessageReceived(message)) {
      log.info(
        `Skipping invoking callbacks for already received message: pubsubTopic:${this.pubsubTopic}, peerId:${_peerId.toString()}, contentTopic:${message.contentTopic}`
      );
      return;
    }

    log.info(`Invoking message for contentTopic: ${message.contentTopic}`);

    this.messageEmitter.dispatchEvent(
      new CustomEvent<WakuMessage>(message.contentTopic, {
        detail: message
      })
    );
  }

  private addSingle<T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ): void {
    log.info(`Adding subscription for contentTopic: ${decoder.contentTopic}`);

    const isNewContentTopic = !this.contentTopics.includes(
      decoder.contentTopic
    );

    if (isNewContentTopic) {
      this.toSubscribeContentTopics.add(decoder.contentTopic);
    }

    if (this.callbacks.has(decoder)) {
      log.warn(
        `Replacing callback associated associated with decoder with pubsubTopic:${decoder.pubsubTopic} and contentTopic:${decoder.contentTopic}`
      );

      const callback = this.callbacks.get(decoder);
      this.callbacks.delete(decoder);
      this.messageEmitter.removeEventListener(decoder.contentTopic, callback);
    }

    const eventHandler = (event: CustomEvent<WakuMessage>): void => {
      void (async (): Promise<void> => {
        try {
          const message = await decoder.fromProtoObj(
            decoder.pubsubTopic,
            event.detail as IProtoMessage
          );
          void callback(message!);
        } catch (err) {
          log.error("Error decoding message", err);
        }
      })();
    };

    this.callbacks.set(decoder, eventHandler);
    this.messageEmitter.addEventListener(decoder.contentTopic, eventHandler);

    log.info(
      `Subscription added for contentTopic: ${decoder.contentTopic}, isNewContentTopic: ${isNewContentTopic}`
    );
  }

  private removeSingle<T extends IDecodedMessage>(decoder: IDecoder<T>): void {
    log.info(`Removing subscription for contentTopic: ${decoder.contentTopic}`);

    const callback = this.callbacks.get(decoder);

    if (!callback) {
      log.warn(
        `No callback associated with decoder with pubsubTopic:${decoder.pubsubTopic} and contentTopic:${decoder.contentTopic}`
      );
    }

    this.callbacks.delete(decoder);
    this.messageEmitter.removeEventListener(decoder.contentTopic, callback);

    const isCompletelyRemoved = !this.contentTopics.includes(
      decoder.contentTopic
    );

    if (isCompletelyRemoved) {
      this.toUnsubscribeContentTopics.add(decoder.contentTopic);
    }

    log.info(
      `Subscription removed for contentTopic: ${decoder.contentTopic}, isCompletelyRemoved: ${isCompletelyRemoved}`
    );
  }

  private isMessageReceived(message: WakuMessage): boolean {
    try {
      const key = messageHashStr(this.pubsubTopic, {
        ...(message as IProtoMessage),
        timestamp: undefined,
        meta: undefined
      });

      if (this.receivedMessages.has(key)) {
        return true;
      }

      this.receivedMessages.add(key);
    } catch (e) {
      // do nothing on throw, message will be handled as not received
    }

    return false;
  }

  private setupSubscriptionInterval(): void {
    const subscriptionRefreshIntervalMs = 1000;

    log.info(
      `Setting up subscription interval with period ${subscriptionRefreshIntervalMs}ms`
    );

    this.subscribeIntervalId = setInterval(() => {
      const run = async (): Promise<void> => {
        if (this.toSubscribeContentTopics.size > 0) {
          log.info(
            `Subscription interval: ${this.toSubscribeContentTopics.size} topics to subscribe`
          );
          void (await this.attemptSubscribe({ useNewContentTopics: true }));
        }

        if (this.toUnsubscribeContentTopics.size > 0) {
          log.info(
            `Subscription interval: ${this.toUnsubscribeContentTopics.size} topics to unsubscribe`
          );
          void (await this.attemptUnsubscribe({ useNewContentTopics: true }));
        }
      };

      void run();
    }, subscriptionRefreshIntervalMs) as unknown as number;
  }

  private setupKeepAliveInterval(): void {
    log.info(
      `Setting up keep-alive interval with period ${this.config.keepAliveIntervalMs}ms`
    );

    this.keepAliveIntervalId = setInterval(() => {
      const run = async (): Promise<void> => {
        log.info(`Keep-alive interval running for ${this.peers.size} peers`);

        let peersToReplace = await Promise.all(
          Array.from(this.peers.values()).map(
            async (peer): Promise<PeerId | undefined> => {
              const response = await this.protocol.ping(peer);

              if (response.success) {
                log.info(`Ping successful for peer: ${peer.toString()}`);
                this.peerFailures.set(peer.toString(), 0);
                return;
              }

              let failures = this.peerFailures.get(peer.toString()) || 0;
              failures += 1;
              this.peerFailures.set(peer.toString(), failures);

              log.warn(
                `Ping failed for peer: ${peer.toString()}, failures: ${failures}/${this.config.pingsBeforePeerRenewed}`
              );

              if (failures < this.config.pingsBeforePeerRenewed) {
                return;
              }

              log.info(
                `Peer ${peer.toString()} exceeded max failures (${this.config.pingsBeforePeerRenewed}), will be replaced`
              );
              return peer;
            }
          )
        );

        peersToReplace = peersToReplace.filter((p) => !!p);

        await Promise.all(
          peersToReplace.map((p) => {
            this.peers.delete(p?.toString() as PeerIdStr);
            this.peerFailures.delete(p?.toString() as PeerIdStr);
            return this.requestUnsubscribe(p as PeerId, this.contentTopics);
          })
        );

        if (peersToReplace.length > 0) {
          log.info(`Replacing ${peersToReplace.length} failed peers`);

          void (await this.attemptSubscribe({
            useNewContentTopics: false,
            useOnlyNewPeers: true
          }));
        }
      };

      void run();
    }, this.config.keepAliveIntervalMs) as unknown as number;
  }

  private setupEventListeners(): void {
    this.peerManager.events.addEventListener(
      PeerManagerEventNames.Connect,
      this.onPeerConnected as Libp2pEventHandler
    );
    this.peerManager.events.addEventListener(
      PeerManagerEventNames.Disconnect,
      this.onPeerDisconnected as Libp2pEventHandler
    );
  }

  private disposeIntervals(): void {
    if (this.subscribeIntervalId) {
      clearInterval(this.subscribeIntervalId);
    }

    if (this.keepAliveIntervalId) {
      clearInterval(this.keepAliveIntervalId);
    }
  }

  private disposeHandlers(): void {
    for (const [decoder, handler] of this.callbacks.entries()) {
      this.messageEmitter.removeEventListener(decoder.contentTopic, handler);
    }
    this.callbacks.clear();
  }

  private async disposePeers(): Promise<void> {
    await this.attemptUnsubscribe({ useNewContentTopics: false });

    this.peers.clear();
    this.peerFailures = new Map();
  }

  private disposeEventListeners(): void {
    this.peerManager.events.removeEventListener(
      PeerManagerEventNames.Connect,
      this.onPeerConnected as Libp2pEventHandler
    );
    this.peerManager.events.removeEventListener(
      PeerManagerEventNames.Disconnect,
      this.onPeerDisconnected as Libp2pEventHandler
    );
  }

  private async onPeerConnected(event: CustomEvent<PeerId>): Promise<void> {
    const id = event.detail?.toString();
    log.info(`Peer connected: ${id}`);

    const usablePeer = await this.peerManager.isPeerOnPubsub(
      event.detail,
      this.pubsubTopic
    );

    if (!usablePeer) {
      log.info(`Peer ${id} doesn't support pubsubTopic:${this.pubsubTopic}`);
      return;
    }

    // skip the peer we already subscribe to
    if (this.peers.has(id)) {
      log.info(`Peer ${id} already subscribed, skipping`);
      return;
    }

    await this.attemptSubscribe({
      useNewContentTopics: false,
      useOnlyNewPeers: true
    });
  }

  private async onPeerDisconnected(event: CustomEvent<PeerId>): Promise<void> {
    const id = event.detail?.toString();
    log.info(`Peer disconnected: ${id}`);

    const usablePeer = await this.peerManager.isPeerOnPubsub(
      event.detail,
      this.pubsubTopic
    );

    if (!usablePeer) {
      log.info(`Peer ${id} doesn't support pubsubTopic:${this.pubsubTopic}`);
      return;
    }

    // ignore as the peer is not the one that is in use
    if (!this.peers.has(id)) {
      log.info(`Disconnected peer ${id} not in use, ignoring`);
      return;
    }

    log.info(`Active peer ${id} disconnected, removing from peers list`);

    this.peers.delete(id);
    void this.attemptSubscribe({
      useNewContentTopics: false,
      useOnlyNewPeers: true
    });
  }

  private async attemptSubscribe(
    params: AttemptSubscribeParams
  ): Promise<boolean> {
    const { useNewContentTopics, useOnlyNewPeers = false } = params;

    const contentTopics = useNewContentTopics
      ? Array.from(this.toSubscribeContentTopics)
      : this.contentTopics;

    log.info(
      `Attempting to subscribe: useNewContentTopics=${useNewContentTopics}, useOnlyNewPeers=${useOnlyNewPeers}, contentTopics=${contentTopics.length}`
    );

    if (!contentTopics.length) {
      log.warn("Requested content topics is an empty array, skipping");
      return false;
    }

    const prevPeers = new Set<PeerIdStr>(this.peers.keys());
    const peersToAdd = await this.peerManager.getPeers({
      protocol: Protocols.Filter,
      pubsubTopic: this.pubsubTopic
    });

    for (const peer of peersToAdd) {
      if (this.peers.size >= this.config.numPeersToUse) {
        break;
      }

      this.peers.set(peer.toString(), peer);
    }

    const peersToUse = useOnlyNewPeers
      ? Array.from(this.peers.values()).filter(
          (p) => !prevPeers.has(p.toString())
        )
      : Array.from(this.peers.values());

    log.info(
      `Subscribing with ${peersToUse.length} peers for ${contentTopics.length} content topics`
    );

    if (useOnlyNewPeers && peersToUse.length === 0) {
      log.warn(`Requested to use only new peers, but no peers found, skipping`);
      return false;
    }

    const results = await Promise.all(
      peersToUse.map((p) => this.requestSubscribe(p, contentTopics))
    );

    const successCount = results.filter((r) => r).length;
    log.info(
      `Subscribe attempts completed: ${successCount}/${results.length} successful`
    );

    if (useNewContentTopics) {
      this.toSubscribeContentTopics = new Set();
    }

    return results.some((v) => v);
  }

  private async requestSubscribe(
    peerId: PeerId,
    contentTopics: string[]
  ): Promise<boolean> {
    log.info(
      `requestSubscribe: pubsubTopic:${this.pubsubTopic}\tcontentTopics:${contentTopics.join(",")}`
    );

    if (!contentTopics.length || !this.pubsubTopic) {
      log.warn(
        `requestSubscribe: no contentTopics or pubsubTopic provided, not sending subscribe request`
      );
      return false;
    }

    const response = await this.protocol.subscribe(
      this.pubsubTopic,
      peerId,
      contentTopics
    );

    if (response.failure) {
      log.warn(
        `requestSubscribe: Failed to subscribe ${this.pubsubTopic} to ${peerId.toString()} with error:${response.failure.error} for contentTopics:${contentTopics}`
      );
      return false;
    }

    log.info(
      `requestSubscribe: Subscribed ${this.pubsubTopic} to ${peerId.toString()} for contentTopics:${contentTopics}`
    );

    return true;
  }

  private async attemptUnsubscribe(
    params: AttemptUnsubscribeParams
  ): Promise<boolean> {
    const { useNewContentTopics } = params;

    const contentTopics = useNewContentTopics
      ? Array.from(this.toUnsubscribeContentTopics)
      : this.contentTopics;

    log.info(
      `Attempting to unsubscribe: useNewContentTopics=${useNewContentTopics}, contentTopics=${contentTopics.length}`
    );

    if (!contentTopics.length) {
      log.warn("Requested content topics is an empty array, skipping");
      return false;
    }

    const peersToUse = Array.from(this.peers.values());
    const result = await Promise.all(
      peersToUse.map((p) =>
        this.requestUnsubscribe(
          p,
          useNewContentTopics ? contentTopics : undefined
        )
      )
    );

    const successCount = result.filter((r) => r).length;
    log.info(
      `Unsubscribe attempts completed: ${successCount}/${result.length} successful`
    );

    if (useNewContentTopics) {
      this.toUnsubscribeContentTopics = new Set();
    }

    return result.some((v) => v);
  }

  private async requestUnsubscribe(
    peerId: PeerId,
    contentTopics?: string[]
  ): Promise<boolean> {
    const response = contentTopics
      ? await this.protocol.unsubscribe(this.pubsubTopic, peerId, contentTopics)
      : await this.protocol.unsubscribeAll(this.pubsubTopic, peerId);

    if (response.failure) {
      log.warn(
        `requestUnsubscribe: Failed to unsubscribe for pubsubTopic:${this.pubsubTopic} from peerId:${peerId.toString()} with error:${response.failure?.error} for contentTopics:${contentTopics}`
      );
      return false;
    }

    log.info(
      `requestUnsubscribe: Unsubscribed pubsubTopic:${this.pubsubTopic} from peerId:${peerId.toString()} for contentTopics:${contentTopics}`
    );

    return true;
  }
}
