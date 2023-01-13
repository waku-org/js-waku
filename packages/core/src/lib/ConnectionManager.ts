import { Connection } from "@libp2p/interface-connection";
import { PeerId } from "@libp2p/interface-peer-id";
import { Peer } from "@libp2p/interface-peer-store";
import { IRelay, Tags } from "@waku/interfaces";
import debug from "debug";
import { Libp2p } from "libp2p";

import { createEncoder } from "../index.js";

import { RelayPingContentTopic } from "./relay/constants.js";

const log = debug("waku:connection-manager");

const DEFAULT_PEER_DISCOVERY_CONNECTION_INTERVAL = 10 * 1000;
const DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED = 1;
const DEFAULT_DIAL_ATTEMPTS_BEFORE_BOOTSTRAP_CONNECTION = 5;

export interface Options {
  relayKeepAlive: number;
  pingKeepAlive: number;
  /**
   * Max number of bootstrap peers allowed to be connected to, initially
   * This is used to increase intention of dialing non-bootstrap peers, found using other discovery mechanisms (like Peer Exchange)
   * Is overridden by @link dialAttemptsBeforeBootstrapConnection
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
  dialAttemptsBeforeBootstrapConnection?: number;
}

interface UpdatedStates {
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
export class ConnectionManager {
  private static instance: ConnectionManager;
  private libp2p: Libp2p;
  private relay?: IRelay;
  private pingKeepAliveTimers: {
    [peer: string]: ReturnType<typeof setInterval>;
  };
  private relayKeepAliveTimers: {
    [peer: string]: ReturnType<typeof setInterval>;
  };
  private dialAttempt: number;

  public isConnectionServiceStarted = false;

  public static create(libp2p: Libp2p, options: Options): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(libp2p, options);
    }
    return ConnectionManager.instance;
  }

  private constructor(libp2p: Libp2p, options: Options, relay?: IRelay) {
    this.libp2p = libp2p;
    this.pingKeepAliveTimers = {};
    this.relayKeepAliveTimers = {};
    this.relay = relay;

    this.startDiscoveryConnectionService(
      options.maxBootstrapPeersAllowed,
      options.peerDiscoveryIntervalFactor
    );
    this.attachEventListeners(options.pingKeepAlive, options.relayKeepAlive);
  }

  public startDiscoveryConnectionService(
    maxBootstrapPeersAllowed = DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED,
    interval = DEFAULT_PEER_DISCOVERY_CONNECTION_INTERVAL
  ): void {
    if (this.isConnectionServiceStarted) {
      throw new Error("Connection service already started");
    }

    this.isConnectionServiceStarted = true;

    this.dialAttempt = 1;

    this.dialPeersInInterval(maxBootstrapPeersAllowed, interval);
  }

  public stopAllKeepAlives(): void {
    for (const timer of [
      ...Object.values(this.pingKeepAliveTimers),
      ...Object.values(this.relayKeepAliveTimers),
    ]) {
      clearInterval(timer);
    }

    this.pingKeepAliveTimers = {};
    this.relayKeepAliveTimers = {};
  }

  private attachEventListeners(
    pingKeepAlive: number,
    relayKeepAlive: number
  ): void {
    this.libp2p.connectionManager.addEventListener("peer:connect", (evt) => {
      this.startKeepAlive(evt.detail.remotePeer, pingKeepAlive, relayKeepAlive);
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
    interval: number
  ): void {
    // increase interval after every attempt
    // -> 1st interval: 10 seconds x 2 = 20 seconds
    // -> 2nd interval: 10 seconds x 3 = 40 seconds
    // and so on
    const newInterval = this.dialAttempt * interval;
    log(`Dialing next set of discovered peers in ${newInterval} ms`);

    // recursively run this function with increase in time
    setTimeout(() => {
      this.dialDiscoveredPeers(maxBootstrapPeersAllowed)
        .then(() => {
          this.dialPeersInInterval(maxBootstrapPeersAllowed, interval);
        })
        .catch((err) => {
          log("Error dialing discovered peers", err);
        });
      this.dialAttempt++;
    }, newInterval);
  }

  private async dialDiscoveredPeers(
    maxBootstrapPeersAllowed: number
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
      this.dialAttempt >= DEFAULT_DIAL_ATTEMPTS_BEFORE_BOOTSTRAP_CONNECTION
    ) {
      for (let i = 0; i < maxBootstrapPeersAllowed; i++) {
        const peer = dialableBootstrapPeers[i];
        if (!peer) break;

        this.dialPeer(peer)
          .then(() => log(`Dial successful`))
          .catch((error) => log(error));
      }
    }

    //find & dial peers found via discovery mechanisms other than `dns-discovery`
    for (const peer of dialableNonBootstrapPeers) {
      this.dialPeer(peer)
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
      (DEFAULT_PEER_DISCOVERY_CONNECTION_INTERVAL * this.dialAttempt) / 1000;

    log(
      `
      ====================
      Connected peers: ${allConnections.length}. 
        Bootstrap: ${bootstrapConnections.length}. 
        Others: ${nonBootstrapConnections.length}.
      Current dialable peers in Peer Store: ${allDialablePeers.length}.
        Bootstrap: ${dialableBootstrapPeers.length}.
        Others: ${dialableNonBootstrapPeers.length}.
      Dial attempt #${this.dialAttempt} - next attempt in ${nextAttempt} seconds.
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

  private async dialPeer(peer: Peer): Promise<void> {
    try {
      const peerId = peer.id;

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
      //remove peer from peerStore if dial fails
      log("Deleting undialable peer" + peer.id.toString() + "from peerStore");
      this.libp2p.peerStore.delete(peer.id);
      throw `Failed to dial ${peer.id.toString()} - ${error}`;
    }
  }

  private startKeepAlive(
    peerId: PeerId,
    pingPeriodSecs: number,
    relayPeriodSecs: number
  ): void {
    // Just in case a timer already exist for this peer
    this.stopKeepAlive(peerId);

    const peerIdStr = peerId.toString();

    if (pingPeriodSecs !== 0) {
      this.pingKeepAliveTimers[peerIdStr] = setInterval(() => {
        this.libp2p.ping(peerId).catch((e) => {
          log(`Ping failed (${peerIdStr})`, e);
        });
      }, pingPeriodSecs * 1000);
    }

    const relay = this.relay;
    if (relay && relayPeriodSecs !== 0) {
      const encoder = createEncoder(RelayPingContentTopic);
      this.relayKeepAliveTimers[peerIdStr] = setInterval(() => {
        log("Sending Waku Relay ping message");
        relay
          .send(encoder, { payload: new Uint8Array() })
          .catch((e) => log("Failed to send relay ping", e));
      }, relayPeriodSecs * 1000);
    }
  }

  private stopKeepAlive(peerId: PeerId): void {
    const peerIdStr = peerId.toString();

    if (this.pingKeepAliveTimers[peerIdStr]) {
      clearInterval(this.pingKeepAliveTimers[peerIdStr]);
      delete this.pingKeepAliveTimers[peerIdStr];
    }

    if (this.relayKeepAliveTimers[peerIdStr]) {
      clearInterval(this.relayKeepAliveTimers[peerIdStr]);
      delete this.relayKeepAliveTimers[peerIdStr];
    }
  }
}
