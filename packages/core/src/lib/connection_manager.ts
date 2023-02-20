import type { Connection } from "@libp2p/interface-connection";
import type { Libp2p } from "@libp2p/interface-libp2p";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerInfo } from "@libp2p/interface-peer-info";
import type { ConnectionManagerOptions, IRelay } from "@waku/interfaces";
import { Tags } from "@waku/interfaces";
import debug from "debug";

import { KeepAliveManager, KeepAliveOptions } from "./keep_alive_manager.js";

const log = debug("waku:connection-manager");

export const DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED = 1;
export const DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER = 3;

export class ConnectionManager {
  private static instances = new Map<string, ConnectionManager>();
  private keepAliveManager: KeepAliveManager;
  private options: ConnectionManagerOptions;
  private libp2pComponents: Libp2p;
  private dialAttemptsForPeer: Map<string, number> = new Map();

  public static create(
    peerId: string,
    libp2p: Libp2p,
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay,
    options?: ConnectionManagerOptions
  ): ConnectionManager {
    let instance = ConnectionManager.instances.get(peerId);
    if (!instance) {
      instance = new ConnectionManager(
        libp2p,
        keepAliveOptions,
        relay,
        options
      );
      ConnectionManager.instances.set(peerId, instance);
    }

    return instance;
  }

  private constructor(
    libp2pComponents: Libp2p,
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay,
    options?: Partial<ConnectionManagerOptions>
  ) {
    this.libp2pComponents = libp2pComponents;
    this.options = {
      maxDialAttemptsForPeer: DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER,
      maxBootstrapPeersAllowed: DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED,
      ...options,
    };

    this.keepAliveManager = new KeepAliveManager(keepAliveOptions, relay);

    this.run()
      .then(() => log(`Connection Manager is now running`))
      .catch((error) => log(`Unexpected error while running service`, error));
  }

  private async run(): Promise<void> {
    // start event listeners
    this.startPeerDiscoveryListener();
    this.startPeerConnectionListener();
    this.startPeerDisconnectionListener();
  }

  stop(): void {
    this.keepAliveManager.stopAll();
    this.libp2pComponents.removeEventListener(
      "peer:connect",
      this.onEventHandlers["peer:connect"]
    );
    this.libp2pComponents.removeEventListener(
      "peer:disconnect",
      this.onEventHandlers["peer:disconnect"]
    );
    this.libp2pComponents.removeEventListener(
      "peer:discovery",
      this.onEventHandlers["peer:discovery"]
    );
  }

  private async dialPeer(peerId: PeerId): Promise<void> {
    let dialAttempt = 0;
    while (dialAttempt <= this.options.maxDialAttemptsForPeer) {
      try {
        log(`Dialing peer ${peerId.toString()}`);
        await this.libp2pComponents.dial(peerId);

        const tags = await this.getTagNamesForPeer(peerId);
        // add tag to connection describing discovery mechanism
        // don't add duplicate tags
        this.libp2pComponents
          .getConnections(peerId)
          .forEach(
            (conn) => (conn.tags = Array.from(new Set([...conn.tags, ...tags])))
          );

        this.dialAttemptsForPeer.delete(peerId.toString());
        return;
      } catch (error) {
        log(`
          Error dialing peer ${peerId.toString()}`);
        dialAttempt = this.dialAttemptsForPeer.get(peerId.toString()) ?? 1;
        this.dialAttemptsForPeer.set(peerId.toString(), dialAttempt + 1);

        if (dialAttempt <= this.options.maxDialAttemptsForPeer) {
          log(`Reattempting dial (${dialAttempt})`);
        }
      }
    }

    try {
      log(`Deleting undialable peer ${peerId.toString()} from peer store`);
      return await this.libp2pComponents.peerStore.delete(peerId);
    } catch (error) {
      throw `Error deleting undialable peer ${peerId.toString()} from peer store - ${error}`;
    }
  }

  private startPeerDiscoveryListener(): void {
    this.libp2pComponents.peerStore.addEventListener(
      "peer",
      this.onEventHandlers["peer:discovery"]
    );
  }

  private startPeerConnectionListener(): void {
    this.libp2pComponents.addEventListener(
      "peer:connect",
      this.onEventHandlers["peer:connect"]
    );
  }

  private startPeerDisconnectionListener(): void {
    // TODO: ensure that these following issues are updated and confirmed
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
    this.libp2pComponents.addEventListener(
      "peer:disconnect",
      this.onEventHandlers["peer:disconnect"]
    );
  }

  private onEventHandlers = {
    "peer:discovery": async (evt: CustomEvent<PeerInfo>): Promise<void> => {
      const { id: peerId } = evt.detail;
      if (!(await this.shouldDialPeer(peerId))) return;

      this.dialPeer(peerId).catch((err) =>
        log(`Error dialing peer ${peerId.toString()} : ${err}`)
      );
    },
    "peer:connect": (evt: CustomEvent<Connection>): void => {
      {
        this.keepAliveManager.start(
          evt.detail.remotePeer,
          this.libp2pComponents.ping.bind(this)
        );
      }
    },
    "peer:disconnect": () => {
      return (evt: CustomEvent<Connection>): void => {
        this.keepAliveManager.stop(evt.detail.remotePeer);
      };
    },
  };

  /**
   * Checks if the peer is dialable based on the following conditions:
   * 1. If the peer is a bootstrap peer, it is only dialable if the number of current bootstrap connections is less than the max allowed.
   * 2. If the peer is not a bootstrap peer
   */
  private async shouldDialPeer(peerId: PeerId): Promise<boolean> {
    const isConnected = this.libp2pComponents.getConnections(peerId).length > 0;

    if (isConnected) return false;

    const isBootstrap = (await this.getTagNamesForPeer(peerId)).some(
      (tagName) => tagName === Tags.BOOTSTRAP
    );

    if (isBootstrap) {
      const currentBootstrapConnections = this.libp2pComponents
        .getConnections()
        .filter((conn) => {
          conn.tags.find((name) => name === Tags.BOOTSTRAP);
        }).length;
      if (currentBootstrapConnections < this.options.maxBootstrapPeersAllowed)
        return true;
    } else {
      return true;
    }

    return false;
  }

  /**
   * Fetches the tag names for a given peer
   */
  private async getTagNamesForPeer(peerId: PeerId): Promise<string[]> {
    const tags = (await this.libp2pComponents.peerStore.getTags(peerId)).map(
      (tag) => tag.name
    );
    return tags;
  }
}
