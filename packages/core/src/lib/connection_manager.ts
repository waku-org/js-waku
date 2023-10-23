import type { PeerId } from "@libp2p/interface/peer-id";
import type { PeerInfo } from "@libp2p/interface/peer-info";
import type { Peer } from "@libp2p/interface/peer-store";
import type { PeerStore } from "@libp2p/interface/peer-store";
import { CustomEvent, EventEmitter } from "@libp2p/interfaces/events";
import { decodeRelayShard } from "@waku/enr";
import {
  ConnectionManagerOptions,
  EPeersByDiscoveryEvents,
  IConnectionManager,
  IPeersByDiscoveryEvents,
  IRelay,
  KeepAliveOptions,
  PeersByDiscoveryResult,
  PubSubTopic,
  ShardInfo
} from "@waku/interfaces";
import { Libp2p, Tags } from "@waku/interfaces";
import { shardInfoToPubSubTopics } from "@waku/utils";
import { Logger } from "@waku/utils";

import { KeepAliveManager } from "./keep_alive_manager.js";

const log = new Logger("connection-manager");

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

  private currentActiveParallelDialCount = 0;
  private pendingPeerDialQueue: Array<PeerId> = [];

  public static create(
    peerId: string,
    libp2p: Libp2p,
    keepAliveOptions: KeepAliveOptions,
    pubsubTopics: PubSubTopic[],
    relay?: IRelay,
    options?: ConnectionManagerOptions
  ): ConnectionManager {
    let instance = ConnectionManager.instances.get(peerId);
    if (!instance) {
      instance = new ConnectionManager(
        libp2p,
        keepAliveOptions,
        pubsubTopics,
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
    private configuredPubSubTopics: PubSubTopic[],
    relay?: IRelay,
    options?: Partial<ConnectionManagerOptions>
  ) {
    super();
    this.libp2p = libp2p;
    this.configuredPubSubTopics = configuredPubSubTopics;
    this.options = {
      maxDialAttemptsForPeer: DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER,
      maxBootstrapPeersAllowed: DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED,
      maxParallelDials: DEFAULT_MAX_PARALLEL_DIALS,
      ...options
    };

    this.keepAliveManager = new KeepAliveManager(keepAliveOptions, relay);

    this.run()
      .then(() => log.info(`Connection Manager is now running`))
      .catch((error) =>
        log.error(`Unexpected error while running service`, error)
      );

    // libp2p emits `peer:discovery` events during its initialization
    // which means that before the ConnectionManager is initialized, some peers may have been discovered
    // we will dial the peers in peerStore ONCE before we start to listen to the `peer:discovery` events within the ConnectionManager
    this.dialPeerStorePeers().catch((error) =>
      log.error(`Unexpected error while dialing peer store peers`, error)
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
      log.error(`Unexpected error while dialing peer store peers`, error);
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
    this.currentActiveParallelDialCount += 1;
    let dialAttempt = 0;
    while (dialAttempt < this.options.maxDialAttemptsForPeer) {
      try {
        log.info(
          `Dialing peer ${peerId.toString()} on attempt ${dialAttempt + 1}`
        );
        await this.libp2p.dial(peerId);

        const tags = await this.getTagNamesForPeer(peerId);
        // add tag to connection describing discovery mechanism
        // don't add duplicate tags
        this.libp2p.getConnections(peerId).forEach((conn) => {
          conn.tags = Array.from(new Set([...conn.tags, ...tags]));
        });

        // instead of deleting the peer from the peer store, we set the dial attempt to -1
        // this helps us keep track of peers that have been dialed before
        this.dialAttemptsForPeer.set(peerId.toString(), -1);

        // Dialing succeeded, break the loop
        break;
      } catch (error) {
        if (error instanceof AggregateError) {
          // Handle AggregateError
          log.error(
            `Error dialing peer ${peerId.toString()} - ${error.errors}`
          );
        } else {
          // Handle generic error
          log.error(
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
    this.currentActiveParallelDialCount--;
    this.processDialQueue();

    // If max dial attempts reached and dialing failed, delete the peer
    if (dialAttempt === this.options.maxDialAttemptsForPeer) {
      try {
        const error = this.dialErrorsForPeer.get(peerId.toString());

        if (error) {
          let errorMessage;
          if (error instanceof AggregateError) {
            if (!error.errors) {
              log.warn(`No errors array found for AggregateError`);
            } else if (error.errors.length === 0) {
              log.warn(`Errors array is empty for AggregateError`);
            } else {
              errorMessage = JSON.stringify(error.errors[0]);
            }
          } else {
            errorMessage = error.message;
          }

          log.info(
            `Deleting undialable peer ${peerId.toString()} from peer store. Reason: ${errorMessage}`
          );
        }

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
      log.info(`Dropped connection with peer ${peerId.toString()}`);
    } catch (error) {
      log.error(
        `Error dropping connection with peer ${peerId.toString()} - ${error}`
      );
    }
  }

  private processDialQueue(): void {
    if (
      this.pendingPeerDialQueue.length > 0 &&
      this.currentActiveParallelDialCount < this.options.maxParallelDials
    ) {
      const peerId = this.pendingPeerDialQueue.shift();
      if (!peerId) return;
      this.attemptDial(peerId).catch((error) => {
        log.error(error);
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
    if (!(await this.shouldDialPeer(peerId))) return;

    if (this.currentActiveParallelDialCount >= this.options.maxParallelDials) {
      this.pendingPeerDialQueue.push(peerId);
      return;
    }

    this.dialPeer(peerId).catch((err) => {
      log.error(`Error dialing peer ${peerId.toString()} : ${err}`);
    });
  }

  private onEventHandlers = {
    "peer:discovery": (evt: CustomEvent<PeerInfo>): void => {
      void (async () => {
        const { id: peerId } = evt.detail;

        await this.dispatchDiscoveryEvent(peerId);

        try {
          await this.attemptDial(peerId);
        } catch (error) {
          log.error(`Error dialing peer ${peerId.toString()} : ${error}`);
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
   * Checks if the peer should be dialed based on the following conditions:
   * 1. If the peer is already connected, don't dial
   * 2. If the peer is not part of any of the configured pubsub topics, don't dial
   * 3. If the peer is not dialable based on bootstrap status, don't dial
   * 4. If the peer is already has an active dial attempt, or has been dialed before, don't dial it
   * @returns true if the peer should be dialed, false otherwise
   */
  private async shouldDialPeer(peerId: PeerId): Promise<boolean> {
    // if we're already connected to the peer, don't dial
    const isConnected = this.libp2p.getConnections(peerId).length > 0;
    if (isConnected) {
      log.warn(`Already connected to peer ${peerId.toString()}. Not dialing.`);
      return false;
    }

    // if the peer is not part of any of the configured pubsub topics, don't dial
    if (!(await this.isPeerTopicConfigured(peerId))) {
      const shardInfo = await this.getPeerShardInfo(
        peerId,
        this.libp2p.peerStore
      );
      log.warn(
        `Discovered peer ${peerId.toString()} with ShardInfo ${shardInfo} is not part of any of the configured pubsub topics (${
          this.configuredPubSubTopics
        }). 
            Not dialing.`
      );
      return false;
    }

    // if the peer is not dialable based on bootstrap status, don't dial
    if (!(await this.isPeerDialableBasedOnBootstrapStatus(peerId))) {
      log.warn(
        `Peer ${peerId.toString()} is not dialable based on bootstrap status. Not dialing.`
      );
      return false;
    }

    // If the peer is already already has an active dial attempt, or has been dialed before, don't dial it
    if (this.dialAttemptsForPeer.has(peerId.toString())) {
      log.warn(
        `Peer ${peerId.toString()} has already been attempted dial before, or already has a dial attempt in progress, skipping dial`
      );
      return false;
    }

    return true;
  }

  /**
   * Checks if the peer is dialable based on the following conditions:
   * 1. If the peer is a bootstrap peer, it is only dialable if the number of current bootstrap connections is less than the max allowed.
   * 2. If the peer is not a bootstrap peer
   */
  private async isPeerDialableBasedOnBootstrapStatus(
    peerId: PeerId
  ): Promise<boolean> {
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

  private async dispatchDiscoveryEvent(peerId: PeerId): Promise<void> {
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
  }

  /**
   * Fetches the tag names for a given peer
   */
  private async getTagNamesForPeer(peerId: PeerId): Promise<string[]> {
    try {
      const peer = await this.libp2p.peerStore.get(peerId);
      return Array.from(peer.tags.keys());
    } catch (error) {
      log.error(`Failed to get peer ${peerId}, error: ${error}`);
      return [];
    }
  }

  private async isPeerTopicConfigured(peerId: PeerId): Promise<boolean> {
    const shardInfo = await this.getPeerShardInfo(
      peerId,
      this.libp2p.peerStore
    );

    // If there's no shard information, simply return true
    if (!shardInfo) return true;

    const pubsubTopics = shardInfoToPubSubTopics(shardInfo);

    const isTopicConfigured = pubsubTopics.some((topic) =>
      this.configuredPubSubTopics.includes(topic)
    );
    return isTopicConfigured;
  }

  private async getPeerShardInfo(
    peerId: PeerId,
    peerStore: PeerStore
  ): Promise<ShardInfo | undefined> {
    const peer = await peerStore.get(peerId);
    const shardInfoBytes = peer.metadata.get("shardInfo");
    if (!shardInfoBytes) return undefined;
    return decodeRelayShard(shardInfoBytes);
  }
}
