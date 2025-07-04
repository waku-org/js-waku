import { PeerId } from "@libp2p/interface";
import { ConnectionManagerOptions, Libp2p, Tags } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import type { KeepAliveManager } from "./keep_alive_manager.js";

const log = new Logger("connection-limiter");

type Libp2pEventHandler<T> = (e: CustomEvent<T>) => void;

type ConnectionLimiterConstructorOptions = {
  libp2p: Libp2p;
  keepAliveManager: KeepAliveManager;
  options: ConnectionManagerOptions;
};

interface IConnectionLimiter {
  start(): void;
  stop(): void;
}

export class ConnectionLimiter implements IConnectionLimiter {
  private readonly libp2p: Libp2p;
  private readonly keepAliveManager: KeepAliveManager;
  private readonly options: ConnectionManagerOptions;

  public constructor(options: ConnectionLimiterConstructorOptions) {
    this.libp2p = options.libp2p;
    this.keepAliveManager = options.keepAliveManager;
    this.options = options.options;

    this.onConnectedEvent = this.onConnectedEvent.bind(this);
    this.onDisconnectedEvent = this.onDisconnectedEvent.bind(this);
  }

  public start(): void {
    // dial all known peers because libp2p might have emitted `peer:discovery` before initialization
    void this.dialPeersFromStore();

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
    this.libp2p.removeEventListener(
      "peer:connect",
      this.onConnectedEvent as Libp2pEventHandler<PeerId>
    );

    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onDisconnectedEvent as Libp2pEventHandler<PeerId>
    );
  }

  private async onConnectedEvent(evt: CustomEvent<PeerId>): Promise<void> {
    log.info(`Connected to peer ${evt.detail.toString()}`);

    const peerId = evt.detail;
    this.keepAliveManager.start(peerId);

    const tags = await this.getTagsForPeer(peerId);
    const isBootstrap = tags.includes(Tags.BOOTSTRAP);

    if (!isBootstrap) {
      return;
    }

    const bootstrapConnections = this.libp2p
      .getConnections()
      .filter((conn) => conn.tags.includes(Tags.BOOTSTRAP));

    if (bootstrapConnections.length > this.options.maxBootstrapPeers) {
      await this.libp2p.hangUp(peerId);
    }
  }

  private async onDisconnectedEvent(evt: CustomEvent<PeerId>): Promise<void> {
    this.keepAliveManager.stop(evt.detail);

    if (this.libp2p.getConnections().length === 0) {
      void this.dialPeersFromStore();
    }
  }

  private async dialPeersFromStore(): Promise<void> {
    const allPeers = await this.libp2p.peerStore.all();
    const promises = allPeers
      .filter(
        (p) =>
          !this.libp2p.getConnections().some((c) => c.remotePeer.equals(p.id))
      )
      .map((p) => this.libp2p.dial(p.id));

    try {
      await Promise.all(promises);
    } catch (error) {
      log.error(`Unexpected error while dialing peer store peers`, error);
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
