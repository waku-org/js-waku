/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  type EventHandler,
  type PeerId,
  TypedEventEmitter
} from "@libp2p/interface";
import { FilterCore } from "@waku/core";
import type {
  Callback,
  NextFilterOptions as FilterOptions,
  IDecodedMessage,
  IDecoder,
  IProtoMessage,
  Libp2p
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

import { SubscriptionEvents, SubscriptionParams } from "./types.js";

const log = new Logger("sdk:filter-subscription");

type AttemptSubscribeParams = {
  useNewContentTopics: boolean;
  useOnlyNewPeers?: boolean;
};

type AttemptUnsubscribeParams = {
  useNewContentTopics: boolean;
};

export class Subscription {
  private readonly libp2p: Libp2p;
  private readonly pubsubTopic: string;
  private readonly protocol: FilterCore;
  private readonly peerManager: PeerManager;

  private readonly config: FilterOptions;

  private isStarted: boolean = false;
  private inProgress: boolean = false;

  private peers = new Set<PeerId>();
  private peerFailures = new Map<PeerId, number>();

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

    this.libp2p = params.libp2p;
    this.protocol = params.protocol;
    this.peerManager = params.peerManager;

    this.onPeerConnected = this.onPeerConnected.bind(this);
    this.onPeerDisconnected = this.onPeerDisconnected.bind(this);
  }

  public start(): void {
    if (this.isStarted || this.inProgress) {
      return;
    }

    this.inProgress = true;

    this.attemptSubscribe({
      useNewContentTopics: false
    });
    this.setupSubscriptionInterval();
    this.setupKeepAliveInterval();
    this.setupEventListeners();

    this.isStarted = true;
    this.inProgress = false;
  }

  public stop(): void {
    if (!this.isStarted || this.inProgress) {
      return;
    }

    this.inProgress = true;

    this.disposeEventListeners();
    this.disposeIntervals();
    void this.disposePeers();
    this.disposeHandlers();

    this.inProgress = false;
    this.isStarted = false;
  }

  public isEmpty(): boolean {
    return this.callbacks.size === 0;
  }

  public async add<T extends IDecodedMessage>(
    decoder: IDecoder<T>,
    callback: Callback<T>
  ): Promise<boolean> {
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
          callback(message!);
        } catch (err) {
          log.error("Error decoding message", err);
        }
      })();
    };

    this.callbacks.set(decoder, eventHandler);
    this.messageEmitter.addEventListener(decoder.contentTopic, eventHandler);

    return isNewContentTopic
      ? await this.attemptSubscribe({ useNewContentTopics: true })
      : true; // if content topic is not new - subscription, most likely exists
  }

  public async remove<T extends IDecodedMessage>(
    decoder: IDecoder<T>
  ): Promise<boolean> {
    const callback = this.callbacks.get(decoder);

    if (!callback) {
      log.warn(
        `No callback associated with decoder with pubsubTopic:${decoder.pubsubTopic} and contentTopic:${decoder.contentTopic}`
      );
      return false;
    }

    this.callbacks.delete(decoder);
    this.messageEmitter.removeEventListener(decoder.contentTopic, callback);

    const isCompletelyRemoved = !this.contentTopics.includes(
      decoder.contentTopic
    );

    if (isCompletelyRemoved) {
      this.toUnsubscribeContentTopics.add(decoder.contentTopic);
    }

    return isCompletelyRemoved
      ? await this.attemptUnsubscribe({ useNewContentTopics: true })
      : true; // no need to unsubscribe if there are other decoders on the contentTopic
  }

  public invoke(message: WakuMessage, _peerId: string): void {
    this.messageEmitter.dispatchEvent(
      new CustomEvent<WakuMessage>(message.contentTopic, {
        detail: message
      })
    );
  }

  private setupSubscriptionInterval(): void {
    this.subscribeIntervalId = setInterval(() => {
      const run = async (): Promise<void> => {
        if (this.toSubscribeContentTopics.size > 0) {
          await this.attemptSubscribe({ useNewContentTopics: true });
        }

        if (this.toUnsubscribeContentTopics.size > 0) {
          await this.attemptUnsubscribe({ useNewContentTopics: true });
        }
      };

      void run();
    }, 1000) as unknown as number;
  }

  private setupKeepAliveInterval(): void {
    this.keepAliveIntervalId = setInterval(() => {
      const run = async (): Promise<void> => {
        const peersToReplace = await Promise.all(
          Array.from(this.peers.values()).map(
            async (peer): Promise<PeerId | undefined> => {
              const response = await this.protocol.ping(peer);

              if (response.success) {
                this.peerFailures.set(peer, 0);
                return;
              }

              let failures = this.peerFailures.get(peer) || 0;
              failures += 1;
              this.peerFailures.set(peer, failures);

              if (failures < this.config.pingsBeforePeerRenewed) {
                return;
              }

              return peer;
            }
          )
        );

        await Promise.all(
          peersToReplace
            .filter((p) => !!p)
            .map((p) => {
              this.peers.delete(p as PeerId);
              this.peerFailures.delete(p as PeerId);
              return this.requestUnsubscribe(p as PeerId, this.contentTopics);
            })
        );

        this.attemptSubscribe({
          useNewContentTopics: false,
          useOnlyNewPeers: true
        });
      };

      void run();
    }, this.config.keepAliveIntervalMs) as unknown as number;
  }

  private setupEventListeners(): void {
    this.libp2p.addEventListener(
      "peer:connect",
      (e) => void this.onPeerConnected(e)
    );
    this.libp2p.addEventListener(
      "peer:disconnect",
      (e) => void this.onPeerDisconnected(e)
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
    this.libp2p.removeEventListener("peer:connect", this.onPeerConnected);
    this.libp2p.removeEventListener("peer:disconnect", this.onPeerDisconnected);
  }

  private onPeerConnected(event: CustomEvent<PeerId>): void {
    // skip the peer we already subscribe to
    if (this.peers.has(event.detail)) {
      return;
    }

    this.attemptSubscribe({
      useNewContentTopics: false,
      useOnlyNewPeers: true
    });
  }

  private onPeerDisconnected(event: CustomEvent<PeerId>): void {
    // ignore as the peer is not the one that is in use
    if (!this.peers.has(event.detail)) {
      return;
    }

    this.peers.delete(event.detail);
    this.attemptSubscribe({
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

    if (!contentTopics.length) {
      log.warn(
        "attemptSubscribe: requested content topics is an empty array, skipping"
      );
      return false;
    }

    const prevPeers = new Set(this.peers);
    const peersToAdd = this.peerManager.getPeers();
    for (const peer of peersToAdd) {
      if (this.peers.size >= this.config.numPeersToUse) {
        break;
      }

      this.peers.add(peer);
    }

    const peersToUse = useOnlyNewPeers
      ? Array.from(this.peers.values()).filter((p) => !prevPeers.has(p))
      : Array.from(this.peers.values());

    if (useOnlyNewPeers && peersToUse.length === 0) {
      log.warn(
        `attemptSubscribe: requested to use only new peers, but no peers found, skipping`
      );
      return false;
    }

    const results = await Promise.all(
      peersToUse.map((p) => this.requestSubscribe(p, contentTopics))
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

    if (!contentTopics.length) {
      log.warn(
        "attemptUnsubscribe: requested content topics is an empty array, skipping"
      );
      return false;
    }

    const peersToUse = Array.from(this.peers.values());
    const result = await Promise.all(
      peersToUse.map((p) => this.requestUnsubscribe(p, contentTopics))
    );

    if (useNewContentTopics) {
      this.toUnsubscribeContentTopics = new Set();
    }

    return result.some((v) => v);
  }

  private async requestUnsubscribe(
    peerId: PeerId,
    contentTopics: string[]
  ): Promise<boolean> {
    const response = await this.protocol.unsubscribe(
      this.pubsubTopic,
      peerId,
      contentTopics
    );

    if (response.failure) {
      log.warn(
        `requestUnsubscribe: Failed to unsubscribe for pubsubTopic:${this.pubsubTopic} from peerId:${peerId.toString()} with error:${response.failure} for contentTopics:${contentTopics}`
      );
      return false;
    }

    log.info(
      `requestUnsubscribe: Unsubscribed pubsubTopic:${this.pubsubTopic} from peerId:${peerId.toString()} for contentTopics:${contentTopics}`
    );

    return true;
  }
}
