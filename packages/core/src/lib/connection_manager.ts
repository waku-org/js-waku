import type { PeerId } from "@libp2p/interface/peer-id";
import type { PeerInfo } from "@libp2p/interface/peer-info";
import type { Peer } from "@libp2p/interface/peer-store";
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";
import {
  ConnectionManagerOptions,
  EPeersByDiscoveryEvents,
  IConnectionManager,
  IPeersByDiscoveryEvents,
  IRelay,
  KeepAliveOptions,
  PeersByDiscoveryResult
} from "@waku/interfaces";
import { Libp2p, Tags } from "@waku/interfaces";
import debug from "debug";

import { KeepAliveManager } from "./keep_alive_manager.js";

const log = debug("waku:connection-manager");

export const DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED = 1;
export const DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER = 3;
export const DEFAULT_MAX_PARALLEL_DIALS = 3;

export class ConnectionManager
  extends EventEmitter<IPeersByDiscoveryEvents>
  implements IConnectionManager
{
  private static instances = new Map<string, ConnectionManager>();
  private keepAliveManager: KeepAliveManager;
  private options: ConnectionManagerOptions;
  private libp2p: Libp2p;
  private dialAttemptsForPeer: Map<string, number> = new Map();
  private dialErrorsForPeer: Map<string, any> = new Map();

  private currentActiveDialCount = 0;
  private pendingPeerDialQueue: Array<PeerId> = [];

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

  public async getPeersByDiscovery(): Promise<PeersByDiscoveryResult> {
    const peersDiscovered = await this.libp2p.peerStore.all();
    const peersConnected = this.libp2p
      .getConnections()
      .map((conn) => conn.remotePeer);

    const peersDiscoveredByBootstrap: Peer[] = [];
    const peersDiscoveredByPeerExchange: Peer[] = [];
    const peersConnectedByBootstrap: Peer[] = [];
    const peersConnectedByPeerExchange: Peer[] = [];

    for (const peer of peersDiscovered) {
      const tags = await this.getTagNamesForPeer(peer.id);

      if (tags.includes(Tags.BOOTSTRAP)) {
        peersDiscoveredByBootstrap.push(peer);
      } else if (tags.includes(Tags.PEER_EXCHANGE)) {
        peersDiscoveredByPeerExchange.push(peer);
      }
    }

    for (const peerId of peersConnected) {
      const peer = await this.libp2p.peerStore.get(peerId);
      const tags = await this.getTagNamesForPeer(peerId);

      if (tags.includes(Tags.BOOTSTRAP)) {
        peersConnectedByBootstrap.push(peer);
      } else if (tags.includes(Tags.PEER_EXCHANGE)) {
        peersConnectedByPeerExchange.push(peer);
      }
    }

    return {
      DISCOVERED: {
        [Tags.BOOTSTRAP]: peersDiscoveredByBootstrap,
        [Tags.PEER_EXCHANGE]: peersDiscoveredByPeerExchange
      },
      CONNECTED: {
        [Tags.BOOTSTRAP]: peersConnectedByBootstrap,
        [Tags.PEER_EXCHANGE]: peersConnectedByPeerExchange
      }
    };
  }

  private constructor(
    libp2p: Libp2p,
    keepAliveOptions: KeepAliveOptions,
    relay?: IRelay,
    options?: Partial<ConnectionManagerOptions>
  ) {
    super();
    this.libp2p = libp2p;
    this.options = {
      maxDialAttemptsForPeer: DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER,
      maxBootstrapPeersAllowed: DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED,
      maxParallelDials: DEFAULT_MAX_PARALLEL_DIALS,
      ...options
    };

    this.keepAliveManager = new KeepAliveManager(keepAliveOptions, relay);

    this.run()
      .then(() => log(`Connection Manager is now running`))
      .catch((error) => log(`Unexpected error while running service`, error));

    // libp2p emits `peer:discovery` events during its initialization
    // which means that before the ConnectionManager is initialized, some peers may have been discovered
    // we will dial the peers in peerStore ONCE before we start to listen to the `peer:discovery` events within the ConnectionManager
    this.dialPeerStorePeers().catch((error) =>
      log(`Unexpected error while dialing peer store peers`, error)
    );
  }

  private async dialPeerStorePeers(): Promise<void> {
    const peerInfos = await this.libp2p.peerStore.all();
    const dialPromises = [];
    for (const peerInfo of peerInfos) {
      if (
        this.libp2p.getConnections().find((c) => c.remotePeer === peerInfo.id)
      )
        continue;

      dialPromises.push(this.attemptDial(peerInfo.id));
    }
    try {
      await Promise.all(dialPromises);
    } catch (error) {
      log(`Unexpected error while dialing peer store peers`, error);
    }
  }

  private async run(): Promise<void> {
    // start event listeners
    this.startPeerDiscoveryListener();
    this.startPeerConnectionListener();
    this.startPeerDisconnectionListener();
  }

  stop(): void {
    this.keepAliveManager.stopAll();
    this.libp2p.removeEventListener(
      "peer:connect",
      this.onEventHandlers["peer:connect"]
    );
    this.libp2p.removeEventListener(
      "peer:disconnect",
      this.onEventHandlers["peer:disconnect"]
    );
    this.libp2p.removeEventListener(
      "peer:discovery",
      this.onEventHandlers["peer:discovery"]
    );
  }

  private async dialPeer(peerId: PeerId): Promise<void> {
    this.currentActiveDialCount += 1;
    let dialAttempt = 0;
    while (dialAttempt < this.options.maxDialAttemptsForPeer) {
      try {
        log(`Dialing peer ${peerId.toString()} on attempt ${dialAttempt + 1}`);
        await this.libp2p.dial(peerId);

        const tags = await this.getTagNamesForPeer(peerId);
        // add tag to connection describing discovery mechanism
        // don't add duplicate tags
        this.libp2p.getConnections(peerId).forEach((conn) => {
          conn.tags = Array.from(new Set([...conn.tags, ...tags]));
        });

        this.dialAttemptsForPeer.delete(peerId.toString());
        // Dialing succeeded, break the loop
        break;
      } catch (error) {
        if (error instanceof AggregateError) {
          // Handle AggregateError
          log(`Error dialing peer ${peerId.toString()} - ${error.errors}`);
        } else {
          // Handle generic error
          log(
            `Error dialing peer ${peerId.toString()} - ${
              (error as any).message
            }`
          );
        }
        this.dialErrorsForPeer.set(peerId.toString(), error);

        dialAttempt++;
        this.dialAttemptsForPeer.set(peerId.toString(), dialAttempt);
      }
    }

    // Always decrease the active dial count and process the dial queue
    this.currentActiveDialCount--;
    this.processDialQueue();

    // If max dial attempts reached and dialing failed, delete the peer
    if (dialAttempt === this.options.maxDialAttemptsForPeer) {
      try {
        const error = this.dialErrorsForPeer.get(peerId.toString());

        let errorMessage;
        if (error instanceof AggregateError) {
          errorMessage = JSON.stringify(error.errors[0]);
        } else {
          errorMessage = error.message;
        }

        log(
          `Deleting undialable peer ${peerId.toString()} from peer store. Error: ${errorMessage}`
        );

        this.dialErrorsForPeer.delete(peerId.toString());
        await this.libp2p.peerStore.delete(peerId);
      } catch (error) {
        throw new Error(
          `Error deleting undialable peer ${peerId.toString()} from peer store - ${error}`
        );
      }
    }
  }

  private async dropConnection(peerId: PeerId): Promise<void> {
    try {
      this.keepAliveManager.stop(peerId);
      await this.libp2p.hangUp(peerId);
      log(`Dropped connection with peer ${peerId.toString()}`);
    } catch (error) {
      log(
        `Error dropping connection with peer ${peerId.toString()} - ${error}`
      );
    }
  }

  private processDialQueue(): void {
    if (
      this.pendingPeerDialQueue.length > 0 &&
      this.currentActiveDialCount < this.options.maxParallelDials
    ) {
      const peerId = this.pendingPeerDialQueue.shift();
      if (!peerId) return;
      this.attemptDial(peerId).catch((error) => {
        log(error);
      });
    }
  }

  private startPeerDiscoveryListener(): void {
    this.libp2p.addEventListener(
      "peer:discovery",
      this.onEventHandlers["peer:discovery"]
    );
  }

  private startPeerConnectionListener(): void {
    this.libp2p.addEventListener(
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
    this.libp2p.addEventListener(
      "peer:disconnect",
      this.onEventHandlers["peer:disconnect"]
    );
  }

  private async attemptDial(peerId: PeerId): Promise<void> {
    if (this.currentActiveDialCount >= this.options.maxParallelDials) {
      this.pendingPeerDialQueue.push(peerId);
      return;
    }

    if (!(await this.shouldDialPeer(peerId))) return;

    this.dialPeer(peerId).catch((err) => {
      throw `Error dialing peer ${peerId.toString()} : ${err}`;
    });
  }

  private onEventHandlers = {
    "peer:discovery": (evt: CustomEvent<PeerInfo>): void => {
      void (async () => {
        const { id: peerId } = evt.detail;

        const isBootstrap = (await this.getTagNamesForPeer(peerId)).includes(
          Tags.BOOTSTRAP
        );

        this.dispatchEvent(
          new CustomEvent<PeerId>(
            isBootstrap
              ? EPeersByDiscoveryEvents.PEER_DISCOVERY_BOOTSTRAP
              : EPeersByDiscoveryEvents.PEER_DISCOVERY_PEER_EXCHANGE,
            {
              detail: peerId
            }
          )
        );

        try {
          await this.attemptDial(peerId);
        } catch (error) {
          log(`Error dialing peer ${peerId.toString()} : ${error}`);
        }
      })();
    },
    "peer:connect": (evt: CustomEvent<PeerId>): void => {
      void (async () => {
        const peerId = evt.detail;

        this.keepAliveManager.start(
          peerId,
          this.libp2p.services.ping,
          this.libp2p.peerStore
        );

        const isBootstrap = (await this.getTagNamesForPeer(peerId)).includes(
          Tags.BOOTSTRAP
        );

        if (isBootstrap) {
          const bootstrapConnections = this.libp2p
            .getConnections()
            .filter((conn) => conn.tags.includes(Tags.BOOTSTRAP));

          // If we have too many bootstrap connections, drop one
          if (
            bootstrapConnections.length > this.options.maxBootstrapPeersAllowed
          ) {
            await this.dropConnection(peerId);
          } else {
            this.dispatchEvent(
              new CustomEvent<PeerId>(
                EPeersByDiscoveryEvents.PEER_CONNECT_BOOTSTRAP,
                {
                  detail: peerId
                }
              )
            );
          }
        } else {
          this.dispatchEvent(
            new CustomEvent<PeerId>(
              EPeersByDiscoveryEvents.PEER_CONNECT_PEER_EXCHANGE,
              {
                detail: peerId
              }
            )
          );
        }
      })();
    },
    "peer:disconnect": () => {
      return (evt: CustomEvent<PeerId>): void => {
        this.keepAliveManager.stop(evt.detail);
      };
    }
  };

  /**
   * Checks if the peer is dialable based on the following conditions:
   * 1. If the peer is a bootstrap peer, it is only dialable if the number of current bootstrap connections is less than the max allowed.
   * 2. If the peer is not a bootstrap peer
   */
  private async shouldDialPeer(peerId: PeerId): Promise<boolean> {
    const isConnected = this.libp2p.getConnections(peerId).length > 0;

    if (isConnected) return false;

    const tagNames = await this.getTagNamesForPeer(peerId);

    const isBootstrap = tagNames.some((tagName) => tagName === Tags.BOOTSTRAP);

    if (isBootstrap) {
      const currentBootstrapConnections = this.libp2p
        .getConnections()
        .filter((conn) => {
          return conn.tags.find((name) => name === Tags.BOOTSTRAP);
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
    try {
      const peer = await this.libp2p.peerStore.get(peerId);
      return Array.from(peer.tags.keys());
    } catch (error) {
      log(`Failed to get peer ${peerId}, error: ${error}`);
      return [];
    }
  }
}
