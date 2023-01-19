import { Connection } from "@libp2p/interface-connection";
import { Peer } from "@libp2p/interface-peer-store";
import { IRelay, Tags } from "@waku/interfaces";
import debug from "debug";
import { Libp2p } from "libp2p";

import KeepAliveManager, { KeepAliveOptions } from "./keep_alive_manager.js";

const log = debug("waku:connection-manager");

const DEFAULT_PEER_DISCOVERY_CONNECTION_INTERVAL = 10 * 1000;
const DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED = 1;
const DEFAULT_DIAL_ATTEMPTS_BEFORE_BOOTSTRAP_CONNECTION = 5;
const DEFAULT_DIAL_MAX_ATTEMPTS_BEFORE_BACKOFF_PEER = 3;

export interface Options {
  /**
   * Max number of bootstrap peers allowed to be connected to, initially
   * This is used to increase intention of dialing non-bootstrap peers, found using other discovery mechanisms (like Peer Exchange)
   * Is overridden by @link dialCountersBeforeBootstrapConnection
   */
  maxBootstrapPeersAllowed?: number;
  /**
   * Factor by which the peer discovery interval is increased after every attempt
   * This is used to reduce the frequency of attempts to connect to nodes
   */
  peerDiscoveryIntervalFactor?: number;
  /**
   * Number of attempts before dialing all available bootstrap nodes
   * This is only used when other discovery mechanisms haven't yeild peers that are dialable
   * This increases relative centralisation of the network
   */
  dialCountersBeforeBootstrapConnection?: number;
  /**
   * Number of attempts before a peer is backoffed
   * This is used to not spam a peer with dial attempts when it is not dialable
   */
  dialAttemptsBeforeBackoffPeer?: number;
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

/**
 * ConnectionManager is a singleton class that manages different steps in a libp2p connection lifecycle
 */
export class ConnectionManager extends KeepAliveManager {
  private static instance: ConnectionManager;
  private libp2p: Libp2p;
  private keepAliveOptions: KeepAliveOptions;
  private dialCounter: number;
  private dialAttemptsForPeer: Map<string, number> = new Map();

  public isConnectionServiceStarted = false;

  public static create(
    libp2p: Libp2p,
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay,
    options?: Options
  ): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(
        libp2p,
        keepAliveOptions,
        relay,
        options
      );
    }
    return ConnectionManager.instance;
  }

  private constructor(
    libp2p: Libp2p,
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay,
    options?: Options
  ) {
    super();
    this.libp2p = libp2p;
    this.keepAliveOptions = keepAliveOptions;

    this.dialCounter = 1;

    const {
      maxBootstrapPeersAllowed,
      peerDiscoveryIntervalFactor,
      dialAttemptsBeforeBackoffPeer,
    } = options || {};

    this.startDiscoveryConnectionService(
      maxBootstrapPeersAllowed,
      peerDiscoveryIntervalFactor,
      dialAttemptsBeforeBackoffPeer
    );
    this.attachEventListeners(relay);
  }

  public startDiscoveryConnectionService(
    maxBootstrapPeersAllowed = DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED,
    interval = DEFAULT_PEER_DISCOVERY_CONNECTION_INTERVAL,
    dialAttemptsBeforeBackoffPeer = DEFAULT_DIAL_MAX_ATTEMPTS_BEFORE_BACKOFF_PEER
  ): void {
    if (this.isConnectionServiceStarted) {
      throw new Error("Connection service already started");
    }

    this.isConnectionServiceStarted = true;

    this.dialPeersInInterval(
      maxBootstrapPeersAllowed,
      interval,
      dialAttemptsBeforeBackoffPeer
    );
  }

  private attachEventListeners(relay?: IRelay): void {
    this.libp2p.connectionManager.addEventListener("peer:connect", (evt) => {
      this.startKeepAlive(
        evt.detail.remotePeer,
        this.libp2p.ping.bind(this),
        this.keepAliveOptions,
        relay
      );
    });

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
    this.libp2p.connectionManager.addEventListener("peer:disconnect", (evt) => {
      this.stopKeepAlive(evt.detail.remotePeer);
    });
  }

  private dialPeersInInterval(
    maxBootstrapPeersAllowed: number,
    interval: number,
    dialAttemptsBeforeBackoffPeer: number
  ): void {
    // increase interval after every attempt
    // -> 1st interval: 10 seconds x 2 = 20 seconds
    // -> 2nd interval: 10 seconds x 3 = 40 seconds
    // and so on
    const newInterval = this.dialCounter * interval;

    log(`Dialing next set of discovered peers in ${newInterval} ms`);

    // recursively run this function with increase in time
    this.dialDiscoveredPeers(
      maxBootstrapPeersAllowed,
      dialAttemptsBeforeBackoffPeer
    )
      .then(() => {
        setTimeout(() => {
          this.dialPeersInInterval(
            maxBootstrapPeersAllowed,
            interval,
            dialAttemptsBeforeBackoffPeer
          );
        }, newInterval);
        this.dialCounter++;
      })
      .catch((err) => {
        log("Error dialing discovered peers", err);
      });
  }

  private async dialDiscoveredPeers(
    maxBootstrapPeersAllowed: number,
    dialAttemptsBeforeBackoffPeer: number
  ): Promise<void> {
    const {
      dialableBootstrapPeers,
      dialableNonBootstrapPeers,
      bootstrapConnections,
    } = await this.fetchUpdatedState();

    // find & dial peers found via `dns-discovery`
    if (
      (bootstrapConnections.length < maxBootstrapPeersAllowed &&
        dialableBootstrapPeers.length > 0) ||
      this.dialCounter >= DEFAULT_DIAL_ATTEMPTS_BEFORE_BOOTSTRAP_CONNECTION
    ) {
      for (let i = 0; i < maxBootstrapPeersAllowed; i++) {
        const peer = dialableBootstrapPeers[i];
        if (!peer) break;

        this.dialPeer(peer, dialAttemptsBeforeBackoffPeer)
          .then(() => log(`Dial successful`))
          .catch((error) => log(error));
      }
    }

    //find & dial peers found via discovery mechanisms other than `dns-discovery`
    for (const peer of dialableNonBootstrapPeers) {
      this.dialPeer(peer, dialAttemptsBeforeBackoffPeer)
        .then(() => log(`Dial successful`))
        .catch((error) => log(error));
    }
  }

  private async fetchUpdatedState(): Promise<UpdatedStates> {
    const allPeers = await this.libp2p.peerStore.all();

    const allDialablePeers: Peer[] = [];
    const bootstrapPeers: Peer[] = [];
    const nonBootstrapPeers: Peer[] = [];
    const dialableBootstrapPeers: Peer[] = [];
    const dialableNonBootstrapPeers: Peer[] = [];
    for (const peer of allPeers) {
      const isBootstrap = (await this.libp2p.peerStore.getTags(peer.id)).some(
        ({ name }) => name === Tags.BOOTSTRAP
      );
      const isConnected =
        this.libp2p.connectionManager.getConnections(peer.id).length > 0;

      if (!isConnected) {
        allDialablePeers.push(peer);
      }

      if (isBootstrap) {
        bootstrapPeers.push(peer);
        if (!isConnected) dialableBootstrapPeers.push(peer);
      } else if (!isBootstrap) {
        nonBootstrapPeers.push(peer);
        if (!isConnected) dialableNonBootstrapPeers.push(peer);
      }
    }

    const allConnections = this.libp2p.connectionManager.getConnections();

    const bootstrapConnections: Connection[] = [];
    const nonBootstrapConnections: Connection[] = [];
    allConnections.forEach((connection) => {
      if (connection.tags.includes(Tags.BOOTSTRAP)) {
        bootstrapConnections.push(connection);
      } else {
        nonBootstrapConnections.push(connection);
      }
    });

    const nextAttempt =
      (DEFAULT_PEER_DISCOVERY_CONNECTION_INTERVAL * this.dialCounter) / 1000;

    log(
      `
      ====================
      Connected peers: ${allConnections.length}. 
        Bootstrap: ${bootstrapConnections.length}. 
        Others: ${nonBootstrapConnections.length}.
      Current dialable peers in Peer Store: ${allDialablePeers.length}.
        Bootstrap: ${dialableBootstrapPeers.length}.
        Others: ${dialableNonBootstrapPeers.length}.
      Dial attempt #${this.dialCounter} - next attempt in ${nextAttempt} seconds.
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

  private async dialPeer(peer: Peer, maxAttempts: number): Promise<void> {
    const peerId = peer.id;

    try {
      log(
        `Dialing peer ${peer.id.toString()} with multiaddrs ${peer.addresses.map(
          (addr) => addr.multiaddr
        )}`
      );

      await this.libp2p.dial(peerId);

      const tags = (await this.libp2p.peerStore.getTags(peer.id)).map(
        ({ name }) => name
      );
      // add tag to connection describing discovery mechanism
      this.libp2p.connectionManager.getConnections(peerId).forEach((conn) => {
        conn.tags.push(...tags);
      });
    } catch (error) {
      //remove peer from peerStore if dial fails after max attempts
      const dialAttempt = this.dialAttemptsForPeer.get(peerId.toString()) ?? 0;
      this.dialAttemptsForPeer.set(peerId.toString(), dialAttempt + 1);

      if (dialAttempt >= maxAttempts) {
        log("Deleting undialable peer" + peer.id.toString() + "from peerStore");
        this.libp2p.peerStore.delete(peer.id);
        throw `Failed to dial ${peer.id.toString()} - ${error}`;
      }
    }
  }
}
