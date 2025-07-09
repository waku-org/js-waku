import { Peer, PeerId } from "@libp2p/interface";
import {
  ConnectionManagerOptions,
  IWakuEventEmitter,
  Libp2p,
  Tags
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { Dialer } from "./dialer.js";
import { NetworkMonitor } from "./network_monitor.js";

const log = new Logger("connection-limiter");

type Libp2pEventHandler<T> = (e: CustomEvent<T>) => void;

type ConnectionLimiterConstructorOptions = {
  libp2p: Libp2p;
  events: IWakuEventEmitter;
  dialer: Dialer;
  networkMonitor: NetworkMonitor;
  options: ConnectionManagerOptions;
};

interface IConnectionLimiter {
  start(): void;
  stop(): void;
}

/**
 * This class is responsible for limiting the number of connections to peers.
 * It also dials all known peers because libp2p might have emitted `peer:discovery` before initialization
 * and listen to `peer:connect` and `peer:disconnect` events to manage connections.
 */
export class ConnectionLimiter implements IConnectionLimiter {
  private readonly libp2p: Libp2p;
  private readonly events: IWakuEventEmitter;
  private readonly networkMonitor: NetworkMonitor;
  private readonly dialer: Dialer;

  private readonly options: ConnectionManagerOptions;

  public constructor(options: ConnectionLimiterConstructorOptions) {
    this.libp2p = options.libp2p;
    this.events = options.events;
    this.networkMonitor = options.networkMonitor;
    this.dialer = options.dialer;

    this.options = options.options;

    this.onWakuConnectionEvent = this.onWakuConnectionEvent.bind(this);
    this.onConnectedEvent = this.onConnectedEvent.bind(this);
    this.onDisconnectedEvent = this.onDisconnectedEvent.bind(this);
  }

  public start(): void {
    // dial all known peers because libp2p might have emitted `peer:discovery` before initialization
    void this.dialPeersFromStore();

    this.events.addEventListener("waku:connection", this.onWakuConnectionEvent);

    this.libp2p.addEventListener(
      "peer:connect",
      this.onConnectedEvent as Libp2pEventHandler<PeerId>
    );

    /**
     * NOTE: Event is not being emitted on closing nor losing a connection.
     * @see https://github.com/libp2p/js-libp2p/issues/939
     * @see https://github.com/status-im/js-waku/issues/252
     *
     * >This event will be triggered anytime we are disconnected from another peer,
     * >regardless of the circumstances of that disconnection.
     * >If we happen to have multiple connections to a peer,
     * >this event will **only** be triggered when the last connection is closed.
     * @see https://github.com/libp2p/js-libp2p/blob/bad9e8c0ff58d60a78314077720c82ae331cc55b/doc/API.md?plain=1#L2100
     */
    this.libp2p.addEventListener(
      "peer:disconnect",
      this.onDisconnectedEvent as Libp2pEventHandler<PeerId>
    );
  }

  public stop(): void {
    this.events.removeEventListener(
      "waku:connection",
      this.onWakuConnectionEvent
    );

    this.libp2p.removeEventListener(
      "peer:connect",
      this.onConnectedEvent as Libp2pEventHandler<PeerId>
    );

    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onDisconnectedEvent as Libp2pEventHandler<PeerId>
    );
  }

  private onWakuConnectionEvent(): void {
    if (this.networkMonitor.isBrowserConnected()) {
      void this.dialPeersFromStore();
    }
  }

  private async onConnectedEvent(evt: CustomEvent<PeerId>): Promise<void> {
    log.info(`Connected to peer ${evt.detail.toString()}`);

    const peerId = evt.detail;

    const tags = await this.getTagsForPeer(peerId);
    const isBootstrap = tags.includes(Tags.BOOTSTRAP);

    if (!isBootstrap) {
      log.info(
        `Connected to peer ${peerId.toString()} is not a bootstrap peer`
      );
      return;
    }

    if (await this.hasMoreThanMaxBootstrapConnections()) {
      log.info(
        `Connected to peer ${peerId.toString()} and node has more than max bootstrap connections ${this.options.maxBootstrapPeers}. Dropping connection.`
      );
      await this.libp2p.hangUp(peerId);
    }
  }

  private async onDisconnectedEvent(): Promise<void> {
    if (this.libp2p.getConnections().length === 0) {
      log.info(`No connections, dialing peers from store`);
      await this.dialPeersFromStore();
    }
  }

  private async dialPeersFromStore(): Promise<void> {
    log.info(`Dialing peers from store`);

    const allPeers = await this.libp2p.peerStore.all();
    const allConnections = this.libp2p.getConnections();

    log.info(
      `Found ${allPeers.length} peers in store, and found ${allConnections.length} connections`
    );

    const promises = allPeers
      .filter((p) => !allConnections.some((c) => c.remotePeer.equals(p.id)))
      .map((p) => this.dialer.dial(p.id));

    try {
      log.info(`Dialing ${promises.length} peers from store`);
      await Promise.all(promises);
      log.info(`Dialed ${promises.length} peers from store`);
    } catch (error) {
      log.error(`Unexpected error while dialing peer store peers`, error);
    }
  }

  private async hasMoreThanMaxBootstrapConnections(): Promise<boolean> {
    try {
      const peers = await Promise.all(
        this.libp2p
          .getConnections()
          .map((conn) => conn.remotePeer)
          .map((id) => this.getPeer(id))
      );

      const bootstrapPeers = peers.filter(
        (peer) => peer && peer.tags.has(Tags.BOOTSTRAP)
      );

      return bootstrapPeers.length > this.options.maxBootstrapPeers;
    } catch (error) {
      log.error(
        `Unexpected error while checking for bootstrap connections`,
        error
      );
      return false;
    }
  }

  private async getPeer(peerId: PeerId): Promise<Peer | null> {
    try {
      return await this.libp2p.peerStore.get(peerId);
    } catch (error) {
      log.error(`Failed to get peer ${peerId}, error: ${error}`);
      return null;
    }
  }

  private async getTagsForPeer(peerId: PeerId): Promise<string[]> {
    try {
      const peer = await this.libp2p.peerStore.get(peerId);
      return Array.from(peer.tags.keys());
    } catch (error) {
      log.error(`Failed to get peer ${peerId}, error: ${error}`);
      return [];
    }
  }
}
