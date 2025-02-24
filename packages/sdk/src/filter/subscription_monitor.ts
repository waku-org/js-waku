import type { EventHandler, PeerId } from "@libp2p/interface";
import { FilterCore } from "@waku/core";
import type {
  FilterProtocolOptions,
  IConnectionManager,
  ILightPush,
  IProtoMessage,
  Libp2p
} from "@waku/interfaces";
import { EConnectionStateEvents } from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";

import { PeerManager } from "../peer_manager/index.js";

// TODO(weboko): consider adding as config property or combine with maxAllowedPings
const MAX_SUBSCRIBE_ATTEMPTS = 3;

type SubscriptionMonitorConstructorOptions = {
  pubsubTopic: string;
  config: FilterProtocolOptions;
  libp2p: Libp2p;
  connectionManager: IConnectionManager;
  filter: FilterCore;
  peerManager: PeerManager;
  lightPush?: ILightPush;
  activeSubscriptions: Map<string, unknown>;
};

export class SubscriptionMonitor {
  /**
   * Cached peers that are in use by subscription.
   * Needed to understand if they disconnect later or not.
   */
  public peerIds: PeerId[] = [];

  private isStarted: boolean = false;

  private readonly pubsubTopic: string;
  private readonly config: FilterProtocolOptions;

  private readonly libp2p: Libp2p;
  private readonly filter: FilterCore;
  private readonly peerManager: PeerManager;
  private readonly connectionManager: IConnectionManager;
  private readonly activeSubscriptions: Map<string, unknown>;

  private keepAliveIntervalId: number | undefined;
  private pingFailedAttempts = new Map<string, number>();

  private receivedMessagesFormPeer = new Set<string>();
  private receivedMessages = new Set<string>();
  private verifiedPeers = new Set<string>();

  public constructor(options: SubscriptionMonitorConstructorOptions) {
    this.config = options.config;
    this.connectionManager = options.connectionManager;
    this.filter = options.filter;
    this.peerManager = options.peerManager;
    this.libp2p = options.libp2p;
    this.activeSubscriptions = options.activeSubscriptions;
    this.pubsubTopic = options.pubsubTopic;

    this.onConnectionChange = this.onConnectionChange.bind(this);
    this.onPeerConnected = this.onPeerConnected.bind(this);
    this.onPeerDisconnected = this.onPeerDisconnected.bind(this);
  }

  /**
   * @returns content topic used for Filter verification
   */
  public get reservedContentTopic(): string {
    return `/js-waku-subscription-ping/1/${this.libp2p.peerId.toString()}/utf8`;
  }

  /**
   * Starts:
   * - recurring ping queries;
   * - connection event observers;
   */
  public start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;

    this.startKeepAlive();
    this.startConnectionListener();
    this.startPeerConnectionListener();
  }

  /**
   * Stops all recurring queries, event listeners or timers.
   */
  public stop(): void {
    if (!this.isStarted) {
      return;
    }

    this.isStarted = false;

    this.stopKeepAlive();
    this.stopConnectionListener();
    this.stopPeerConnectionListener();
  }

  /**
   * Method to get peers that are used by particular subscription or, if initially called, peers that can be used by subscription.
   * @returns array of peers
   */
  public async getPeers(): Promise<PeerId[]> {
    if (!this.isStarted) {
      this.peerIds = this.peerManager.getPeers();
    }

    return this.peerIds;
  }

  /**
   * Notifies monitor if message was received.
   *
   * @param peerId peer from which message is received
   * @param message received message
   *
   * @returns true if message was received from peer
   */
  public notifyMessageReceived(
    peerId: string,
    message: IProtoMessage
  ): boolean {
    const hash = this.buildMessageHash(message);

    this.verifiedPeers.add(peerId);
    this.receivedMessagesFormPeer.add(`${peerId}-${hash}`);

    if (this.receivedMessages.has(hash)) {
      return true;
    }

    this.receivedMessages.add(hash);

    return false;
  }

  private buildMessageHash(message: IProtoMessage): string {
    return messageHashStr(this.pubsubTopic, message);
  }

  private startConnectionListener(): void {
    this.connectionManager.addEventListener(
      EConnectionStateEvents.CONNECTION_STATUS,
      this.onConnectionChange as (v: CustomEvent<boolean>) => void
    );
  }

  private stopConnectionListener(): void {
    this.connectionManager.removeEventListener(
      EConnectionStateEvents.CONNECTION_STATUS,
      this.onConnectionChange as (v: CustomEvent<boolean>) => void
    );
  }

  private async onConnectionChange({
    detail: isConnected
  }: CustomEvent<boolean>): Promise<void> {
    if (!isConnected) {
      this.stopKeepAlive();
      return;
    }

    await Promise.all(this.peerIds.map((id) => this.ping(id, true)));
    this.startKeepAlive();
  }

  private startKeepAlive(): void {
    if (this.keepAliveIntervalId) {
      return;
    }

    this.keepAliveIntervalId = setInterval(() => {
      void this.peerIds.map((id) => this.ping(id));
    }, this.config.keepAliveIntervalMs) as unknown as number;
  }

  private stopKeepAlive(): void {
    if (!this.keepAliveIntervalId) {
      return;
    }

    clearInterval(this.keepAliveIntervalId);
    this.keepAliveIntervalId = undefined;
  }

  private startPeerConnectionListener(): void {
    this.libp2p.addEventListener(
      "peer:connect",
      this.onPeerConnected as EventHandler<CustomEvent<PeerId | undefined>>
    );
    this.libp2p.addEventListener(
      "peer:disconnect",
      this.onPeerDisconnected as EventHandler<CustomEvent<PeerId | undefined>>
    );
  }

  private stopPeerConnectionListener(): void {
    this.libp2p.removeEventListener(
      "peer:connect",
      this.onPeerConnected as EventHandler<CustomEvent<PeerId | undefined>>
    );
    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onPeerDisconnected as EventHandler<CustomEvent<PeerId | undefined>>
    );
  }

  // this method keeps track of new connections and will trigger subscribe request if needed
  private async onPeerConnected(_event: CustomEvent<PeerId>): Promise<void> {
    // TODO(weboko): use config.numOfUsedPeers instead of this.peers
    const hasSomePeers = this.peerIds.length > 0;
    if (hasSomePeers) {
      return;
    }

    this.peerIds = this.peerManager.getPeers();
    await Promise.all(this.peerIds.map((id) => this.subscribe(id)));
  }

  // this method keeps track of disconnects and will trigger subscribe request if needed
  private async onPeerDisconnected(event: CustomEvent<PeerId>): Promise<void> {
    const hasNotBeenUsed = !this.peerIds.find((id) => id.equals(event.detail));
    if (hasNotBeenUsed) {
      return;
    }

    this.peerIds = this.peerManager.getPeers();

    // we trigger subscribe for peer that was used before
    // it will expectedly fail and we will initiate addition of a new peer
    await Promise.all(this.peerIds.map((id) => this.subscribe(id)));
  }

  private async subscribe(_peerId: PeerId | undefined): Promise<void> {
    let peerId: PeerId | undefined = _peerId;

    for (let i = 0; i < MAX_SUBSCRIBE_ATTEMPTS; i++) {
      if (!peerId) {
        return;
      }

      const response = await this.filter.subscribe(
        this.pubsubTopic,
        peerId,
        Array.from(this.activeSubscriptions.keys())
      );

      if (response.success) {
        return;
      }

      peerId = this.peerManager.requestRenew(peerId);
    }
  }

  private async ping(
    peerId: PeerId,
    renewOnFirstFail: boolean = false
  ): Promise<void> {
    const peerIdStr = peerId.toString();
    const response = await this.filter.ping(peerId);

    if (response.failure && renewOnFirstFail) {
      const newPeer = this.peerManager.requestRenew(peerId);
      await this.subscribe(newPeer);
      return;
    }

    if (response.failure) {
      const prev = this.pingFailedAttempts.get(peerIdStr) || 0;
      this.pingFailedAttempts.set(peerIdStr, prev + 1);
    }

    if (response.success) {
      this.pingFailedAttempts.set(peerIdStr, 0);
    }

    const madeAttempts = this.pingFailedAttempts.get(peerIdStr) || 0;

    if (madeAttempts >= this.config.pingsBeforePeerRenewed) {
      const newPeer = this.peerManager.requestRenew(peerId);
      await this.subscribe(newPeer);
    }
  }
}
