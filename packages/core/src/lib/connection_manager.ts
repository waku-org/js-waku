import type { Connection } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerInfo } from "@libp2p/interface-peer-info";
import type { Peer } from "@libp2p/interface-peer-store";
import type { IRelay } from "@waku/interfaces";
import { Tags } from "@waku/interfaces";
import debug from "debug";
import type { Libp2p } from "libp2p";

import KeepAliveManager, { KeepAliveOptions } from "./keep_alive_manager.js";

const DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED = 1;
// TODO: add this functionality back
// const DEFAULT_APPROX_TIME_BEFORE_BOOTSTRAP_FALLBACK_MS = 5000;
const DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER = 3;
const DEFAULT_LOGGING_INTERVAL_MS = 10_000;

const log = debug("waku:connection-manager");

export interface Libp2pComponents {
  connectionManager: Libp2p["connectionManager"];
  peerStore: Libp2p["peerStore"];
  ping: Libp2p["ping"];
  dial: Libp2p["dial"];
}

export interface UpdatedStates {
  allPeers: Peer[];
  allDialablePeers: Peer[];
  bootstrapPeers: Peer[];
  nonBootstrapPeers: Peer[];
  dialableBootstrapPeers: Peer[];
  dialableNonBootstrapPeers: Peer[];
  allConnections: Connection[];
  bootstrapConnections: Connection[];
  nonBootstrapConnections: Connection[];
}

export interface Options {
  /**
   * Number of attempts before a peer is considered non-dialable
   * This is used to not spam a peer with dial attempts when it is not dialable
   */
  maxDialAttemptsForPeer?: number;
  /**
   * Max number of bootstrap peers allowed to be connected to, initially
   * This is used to increase intention of dialing non-bootstrap peers, found using other discovery mechanisms (like Peer Exchange)
   * Is overridden by {@link maxDialAttemptsBeforeBootstrapFallback}
   */
  maxBootstrapPeersAllowed?: number;
  // TODO: add this functionality back
  // /**
  //  * Number of attempts before dialling bootstrap nodes over the {@link maxBootstrapPeersAllowed} value.
  //  * Dialing is the process of opening an outgoing connection to a listening peer with a transport that is supported by both peers.
  //  * This is only used when other discovery mechanisms haven't yield peers that are dialable
  //  * This increases relative centralization of the network
  //  */
  // maxTimeBeforeBootstrapFallbackMs?: number;
  /**
   * Interval at which to log the state of the connection manager
   */
  loggingIntervalMs?: number;
}

export class ConnectionManager extends KeepAliveManager {
  private static instances = new Map<string, ConnectionManager>();
  private options: Options;
  private libp2pComponents: Libp2pComponents;
  private dialAttemptsForPeer: Map<string, number> = new Map();

  public static create(
    peerId: string,
    libp2p: Libp2pComponents,
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay,
    options?: Options
  ): ConnectionManager {
    let instance = ConnectionManager.instances.get(peerId);
    if (!instance)
      instance = new ConnectionManager(
        libp2p,
        keepAliveOptions,
        relay,
        options
      );
    ConnectionManager.instances.set(peerId, instance);

    return instance;
  }

  constructor(
    libp2pComponents: Libp2pComponents,
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay,
    options?: Options
  ) {
    super();
    this.libp2pComponents = libp2pComponents;
    this.options = options ?? {};

    this.runService(keepAliveOptions, relay)
      .then(() => log(`Connection Manager is now running`))
      .catch((error) => log(`Unexpected error while running service`, error));
  }

  private async runService(
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay
  ): Promise<void> {
    const { loggingIntervalMs = DEFAULT_LOGGING_INTERVAL_MS } = this.options;

    // log state every N seconds
    setInterval(async () => {
      this.fetchUpdatedState();
    }, loggingIntervalMs);

    // start event listeners
    this.startPeerDiscoveryListener();
    this.startPeerConnectionListener(keepAliveOptions, relay);
    this.startPeerDisconnectionListener();
  }

  stopService(): void {
    this.stopAllKeepAlives();
    this.libp2pComponents.connectionManager.removeEventListener("peer:connect");
    this.libp2pComponents.connectionManager.removeEventListener(
      "peer:disconnect"
    );
    this.libp2pComponents.peerStore.removeEventListener("peer");
  }

  private async dialPeer(peerId: PeerId): Promise<void> {
    const { maxDialAttemptsForPeer = DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER } =
      this.options;

    try {
      log(`Dialing peer ${peerId.toString()}`);
      await this.libp2pComponents.dial(peerId);

      const tags = await this.getTagNamesForPeer(peerId);
      // add tag to connection describing discovery mechanism
      this.libp2pComponents.connectionManager
        .getConnections(peerId)
        .forEach((conn) => conn.tags.push(...tags));

      this.dialAttemptsForPeer.delete(peerId.toString());
    } catch (error) {
      const dialAttempt = this.dialAttemptsForPeer.get(peerId.toString()) ?? 1;
      this.dialAttemptsForPeer.set(peerId.toString(), dialAttempt + 1);

      //remove peer from peerStore if dial fails after max attempts
      if (dialAttempt > maxDialAttemptsForPeer) {
        try {
          log(
            "Deleting undialable peer " +
              peerId.toString() +
              " from peer store as max dial attempts reached"
          );
          await this.libp2pComponents.peerStore.delete(peerId);
          return;
        } catch (error) {
          throw (
            "Error deleting undialable peer" +
            peerId.toString() +
            " from peerStore"
          );
        }
      }

      log(
        `Failed to dial ${peerId.toString()} - reattempting (${dialAttempt})`
      );

      this.dialPeer(peerId);
    }
  }

  private startPeerDiscoveryListener(): void {
    const onPeerDiscovery = () => {
      return async (evt: CustomEvent<PeerInfo>): Promise<void> => {
        const { id: peerId } = evt.detail;
        if (!(await this.shouldDialPeer(peerId))) return;

        this.dialPeer(peerId).catch((err) =>
          log(`Error dialing peer ${peerId.toString()} : ${err}`)
        );
      };
    };

    this.libp2pComponents.peerStore.addEventListener("peer", onPeerDiscovery);
  }

  private startPeerConnectionListener(
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay
  ): void {
    const onPeerConnect = (
      keepAliveOptions: KeepAliveOptions,
      relay?: IRelay
    ) => {
      return (evt: CustomEvent<Connection>): void => {
        {
          this.startKeepAlive(
            evt.detail.remotePeer,
            this.libp2pComponents.ping.bind(this),
            keepAliveOptions,
            relay
          );
        }
      };
    };

    this.libp2pComponents.connectionManager.addEventListener(
      "peer:connect",
      onPeerConnect(keepAliveOptions, relay)
    );
  }

  private startPeerDisconnectionListener(): void {
    const onPeerDisconnect = () => {
      return (evt: CustomEvent<Connection>): void => {
        this.stopKeepAlive(evt.detail.remotePeer);
      };
    };

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
    this.libp2pComponents.connectionManager.addEventListener(
      "peer:disconnect",
      onPeerDisconnect
    );
  }

  /**
   * Checks if the peer is dialable based on the following conditions:
   * 1. If the peer is a bootstrap peer, it is only dialable if the number of current bootstrap connections is less than the max allowed.
   * 2. If the peer is not a bootstrap peer
   */
  private async shouldDialPeer(peerId: PeerId): Promise<boolean> {
    const { maxBootstrapPeersAllowed = DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED } =
      this.options;

    const isConnected =
      this.libp2pComponents.connectionManager.getConnections(peerId).length > 0;

    if (isConnected) return false;

    const isBootstrap = (await this.getTagNamesForPeer(peerId)).some(
      (tagName) => tagName === Tags.BOOTSTRAP
    );

    if (isBootstrap) {
      const currentBootstrapConnections =
        this.libp2pComponents.connectionManager
          .getConnections()
          .filter((conn) => {
            conn.tags.find((name) => name === Tags.BOOTSTRAP);
          }).length;
      if (currentBootstrapConnections < maxBootstrapPeersAllowed) return true;
    } else {
      return true;
    }

    return false;
  }

  /**
   * Fetches the updated state of the libp2p peerStore and connectionManager
   * Also logs the updated state
   * @returns UpdatedStates
   */
  private async fetchUpdatedState(): Promise<UpdatedStates> {
    const allPeers = await this.libp2pComponents.peerStore.all();

    const allDialablePeers: Peer[] = [];
    const bootstrapPeers: Peer[] = [];
    const nonBootstrapPeers: Peer[] = [];
    const dialableBootstrapPeers: Peer[] = [];
    const dialableNonBootstrapPeers: Peer[] = [];
    for (const peer of allPeers) {
      const isConnected =
        this.libp2pComponents.connectionManager.getConnections(peer.id).length >
        0;

      if (!isConnected) {
        allDialablePeers.push(peer);
      }

      const isBootstrap = (await this.getTagNamesForPeer(peer.id)).some(
        (name) => name === Tags.BOOTSTRAP
      );

      if (isBootstrap) {
        bootstrapPeers.push(peer);
        if (!isConnected) dialableBootstrapPeers.push(peer);
      } else {
        nonBootstrapPeers.push(peer);
        if (!isConnected) dialableNonBootstrapPeers.push(peer);
      }
    }

    const allConnections =
      this.libp2pComponents.connectionManager.getConnections();

    const bootstrapConnections: Connection[] = [];
    const nonBootstrapConnections: Connection[] = [];
    allConnections.forEach((connection) => {
      if (connection.tags.includes(Tags.BOOTSTRAP)) {
        bootstrapConnections.push(connection);
      } else {
        nonBootstrapConnections.push(connection);
      }
    });

    log(
      `
      ====================
      Connected peers: ${allConnections.length}. 
        Bootstrap: ${bootstrapConnections.length}. 
        Others: ${nonBootstrapConnections.length}.
      Current dialable peers in Peer Store: ${allDialablePeers.length}.
        Bootstrap: ${dialableBootstrapPeers.length}.
        Others: ${dialableNonBootstrapPeers.length}.
      ====================
      `
    );

    return {
      allPeers,
      allDialablePeers,
      bootstrapPeers,
      nonBootstrapPeers,
      dialableBootstrapPeers,
      dialableNonBootstrapPeers,
      allConnections,
      bootstrapConnections,
      nonBootstrapConnections,
    };
  }

  private async getTagNamesForPeer(peerId: PeerId): Promise<string[]> {
    const tags = (await this.libp2pComponents.peerStore.getTags(peerId)).map(
      (tag) => tag.name
    );
    return tags;
  }

  //TODO: add this functionality back in
  // /**
  //  * Dials all available bootstrap peers in the peerStore
  //  */
  // private async dialAllAvailableBootstrapPeers(): Promise<void> {
  //   const { dialableBootstrapPeers } = await this.fetchUpdatedState();

  //   log(`Dialing ${dialableBootstrapPeers.length} bootstrap peers`);

  //   const promises = [];
  //   for (const peer of dialableBootstrapPeers)
  //     promises.push(this.dialPeer(peer.id));

  //   const results = await Promise.allSettled(promises);

  //   const success = results.filter((result) => result.status === "fulfilled");
  //   if (success.length > 0) log(`Successfully dialed ${success.length} peers`);

  //   const errors = results.filter((result) => result.status === "rejected");
  //   if (errors.length > 0)
  //     log(`Failed to dial ${errors.length} peers -- might retry`);
  // }

  /**
   * Fetches the tag names for a given peer
   */
}
