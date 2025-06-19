import {
  type Connection,
  isPeerId,
  type Peer,
  type PeerId,
  type PeerInfo,
  type Stream,
  TypedEventEmitter
} from "@libp2p/interface";
import { Multiaddr, multiaddr, MultiaddrInput } from "@multiformats/multiaddr";
import {
  ConnectionManagerOptions,
  DiscoveryTrigger,
  DNS_DISCOVERY_TAG,
  EConnectionStateEvents,
  EPeersByDiscoveryEvents,
  IConnectionManager,
  IConnectionStateEvents,
  IPeersByDiscoveryEvents,
  IRelay,
  PeersByDiscoveryResult,
  PubsubTopic,
  ShardInfo
} from "@waku/interfaces";
import { Libp2p, Tags } from "@waku/interfaces";
import { decodeRelayShard, shardInfoToPubsubTopics } from "@waku/utils";
import { Logger } from "@waku/utils";

import { KeepAliveManager } from "./keep_alive_manager.js";
import { getPeerPing } from "./utils.js";

const log = new Logger("connection-manager");

const DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED = 1;
const DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER = 3;
const DEFAULT_MAX_PARALLEL_DIALS = 3;

const DEFAULT_PING_KEEP_ALIVE_SEC = 5 * 60;
const DEFAULT_RELAY_KEEP_ALIVE_SEC = 5 * 60;

type ConnectionManagerConstructorOptions = {
  libp2p: Libp2p;
  pubsubTopics: PubsubTopic[];
  relay?: IRelay;
  config?: Partial<ConnectionManagerOptions>;
};

export class ConnectionManager
  extends TypedEventEmitter<IPeersByDiscoveryEvents & IConnectionStateEvents>
  implements IConnectionManager
{
  // TODO(weboko): make it private
  public readonly pubsubTopics: PubsubTopic[];

  private keepAliveManager: KeepAliveManager;
  private options: ConnectionManagerOptions;
  private libp2p: Libp2p;
  private dialAttemptsForPeer: Map<string, number> = new Map();
  private dialErrorsForPeer: Map<string, any> = new Map();

  private currentActiveParallelDialCount = 0;
  private pendingPeerDialQueue: Array<PeerId> = [];

  private isP2PNetworkConnected: boolean = false;

  public isConnected(): boolean {
    if (globalThis?.navigator && !globalThis?.navigator?.onLine) {
      return false;
    }

    return this.isP2PNetworkConnected;
  }

  public stop(): void {
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
    this.stopNetworkStatusListener();
  }

  public async dropConnection(peerId: PeerId): Promise<void> {
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

  public async getPeersByDiscovery(): Promise<PeersByDiscoveryResult> {
    const peersDiscovered = await this.libp2p.peerStore.all();
    const peersConnected = this.libp2p
      .getConnections()
      .map((conn) => conn.remotePeer);

    const peersDiscoveredByBootstrap: Peer[] = [];
    const peersDiscoveredByPeerExchange: Peer[] = [];
    const peersDiscoveredByLocal: Peer[] = [];

    const peersConnectedByBootstrap: Peer[] = [];
    const peersConnectedByPeerExchange: Peer[] = [];
    const peersConnectedByLocal: Peer[] = [];

    for (const peer of peersDiscovered) {
      const tags = await this.getTagNamesForPeer(peer.id);

      if (tags.includes(Tags.BOOTSTRAP)) {
        peersDiscoveredByBootstrap.push(peer);
      } else if (tags.includes(Tags.PEER_EXCHANGE)) {
        peersDiscoveredByPeerExchange.push(peer);
      } else if (tags.includes(Tags.LOCAL)) {
        peersDiscoveredByLocal.push(peer);
      }
    }

    for (const peerId of peersConnected) {
      const peer = await this.libp2p.peerStore.get(peerId);
      const tags = await this.getTagNamesForPeer(peerId);

      if (tags.includes(Tags.BOOTSTRAP)) {
        peersConnectedByBootstrap.push(peer);
      } else if (tags.includes(Tags.PEER_EXCHANGE)) {
        peersConnectedByPeerExchange.push(peer);
      } else if (tags.includes(Tags.LOCAL)) {
        peersConnectedByLocal.push(peer);
      }
    }

    return {
      DISCOVERED: {
        [Tags.BOOTSTRAP]: peersDiscoveredByBootstrap,
        [Tags.PEER_EXCHANGE]: peersDiscoveredByPeerExchange,
        [Tags.LOCAL]: peersDiscoveredByLocal
      },
      CONNECTED: {
        [Tags.BOOTSTRAP]: peersConnectedByBootstrap,
        [Tags.PEER_EXCHANGE]: peersConnectedByPeerExchange,
        [Tags.LOCAL]: peersConnectedByLocal
      }
    };
  }

  public constructor(options: ConnectionManagerConstructorOptions) {
    super();
    this.libp2p = options.libp2p;
    this.pubsubTopics = options.pubsubTopics;
    this.options = {
      maxDialAttemptsForPeer: DEFAULT_MAX_DIAL_ATTEMPTS_FOR_PEER,
      maxBootstrapPeersAllowed: DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED,
      maxParallelDials: DEFAULT_MAX_PARALLEL_DIALS,
      pingKeepAlive: DEFAULT_PING_KEEP_ALIVE_SEC,
      relayKeepAlive: DEFAULT_RELAY_KEEP_ALIVE_SEC,
      ...options.config
    };

    this.keepAliveManager = new KeepAliveManager({
      relay: options.relay,
      libp2p: options.libp2p,
      options: {
        pingKeepAlive: this.options.pingKeepAlive,
        relayKeepAlive: this.options.relayKeepAlive
      }
    });

    this.startEventListeners()
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

  public async getConnectedPeers(codec?: string): Promise<Peer[]> {
    const peerIDs = this.libp2p.getPeers();

    if (peerIDs.length === 0) {
      return [];
    }

    const peers = await Promise.all(
      peerIDs.map(async (id) => {
        try {
          return await this.libp2p.peerStore.get(id);
        } catch (e) {
          return null;
        }
      })
    );

    return peers
      .filter((p) => !!p)
      .filter((p) => (codec ? (p as Peer).protocols.includes(codec) : true))
      .sort((left, right) => getPeerPing(left) - getPeerPing(right)) as Peer[];
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

  private async startEventListeners(): Promise<void> {
    this.startPeerDiscoveryListener();
    this.startPeerConnectionListener();
    this.startPeerDisconnectionListener();

    this.startNetworkStatusListener();
  }

  /**
   * Attempts to establish a connection with a peer and set up specified protocols.
   * The method handles both PeerId and Multiaddr inputs, manages connection attempts,
   * and maintains the connection state.
   *
   * The dialing process includes:
   * 1. Converting input to dialable peer info
   * 2. Managing parallel dial attempts
   * 3. Attempting to establish protocol-specific connections
   * 4. Handling connection failures and retries
   * 5. Updating the peer store and connection state
   *
   * @param {PeerId | MultiaddrInput} peer - The peer to connect to, either as a PeerId or multiaddr
   * @param {string[]} [protocolCodecs] - Optional array of protocol-specific codec strings to establish
   *                                      (e.g., for LightPush, Filter, Store protocols)
   *
   * @throws {Error} If the multiaddr is missing a peer ID
   * @throws {Error} If the maximum dial attempts are reached and the peer cannot be dialed
   * @throws {Error} If there's an error deleting an undialable peer from the peer store
   *
   * @example
   * ```typescript
   * // Dial using PeerId
   * await connectionManager.dialPeer(peerId);
   *
   * // Dial using multiaddr with specific protocols
   * await connectionManager.dialPeer(multiaddr, [
   *   "/vac/waku/relay/2.0.0",
   *   "/vac/waku/lightpush/2.0.0-beta1"
   * ]);
   * ```
   *
   * @remarks
   * - The method implements exponential backoff through multiple dial attempts
   * - Maintains a queue for parallel dial attempts (limited by maxParallelDials)
   * - Integrates with the KeepAliveManager for connection maintenance
   * - Updates the peer store and connection state after successful/failed attempts
   * - If all dial attempts fail, triggers DNS discovery as a fallback
   */
  public async dialPeer(peer: PeerId | MultiaddrInput): Promise<Connection> {
    let connection: Connection | undefined;
    let peerId: PeerId | undefined;
    const peerDialInfo = this.getDialablePeerInfo(peer);
    const peerIdStr = isPeerId(peerDialInfo)
      ? peerDialInfo.toString()
      : peerDialInfo.getPeerId()!;

    this.currentActiveParallelDialCount += 1;
    let dialAttempt = 0;
    while (dialAttempt < this.options.maxDialAttemptsForPeer) {
      try {
        log.info(`Dialing peer ${peerDialInfo} on attempt ${dialAttempt + 1}`);
        connection = await this.libp2p.dial(peerDialInfo);
        peerId = connection.remotePeer;

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
        this.keepAliveManager.start(peerId);
        break;
      } catch (error) {
        if (error instanceof AggregateError) {
          // Handle AggregateError
          log.error(`Error dialing peer ${peerIdStr} - ${error.errors}`);
        } else {
          // Handle generic error
          log.error(
            `Error dialing peer ${peerIdStr} - ${(error as any).message}`
          );
        }
        this.dialErrorsForPeer.set(peerIdStr, error);

        dialAttempt++;
        this.dialAttemptsForPeer.set(peerIdStr, dialAttempt);
      }
    }

    // Always decrease the active dial count and process the dial queue
    this.currentActiveParallelDialCount--;
    this.processDialQueue();

    // If max dial attempts reached and dialing failed, delete the peer
    if (dialAttempt === this.options.maxDialAttemptsForPeer) {
      try {
        const error = this.dialErrorsForPeer.get(peerIdStr);

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
            `Deleting undialable peer ${peerIdStr} from peer store. Reason: ${errorMessage}`
          );
        }

        this.dialErrorsForPeer.delete(peerIdStr);
        if (peerId) {
          await this.libp2p.peerStore.delete(peerId);
        }

        // if it was last available peer - attempt DNS discovery
        await this.attemptDnsDiscovery();
      } catch (error) {
        throw new Error(
          `Error deleting undialable peer ${peerIdStr} from peer store - ${error}`
        );
      }
    }

    if (!connection) {
      throw new Error(`Failed to dial peer ${peerDialInfo}`);
    }

    return connection;
  }

  /**
   * Dial a peer with specific protocols.
   * This method is a raw proxy to the libp2p dialProtocol method.
   * @param peer - The peer to connect to, either as a PeerId or multiaddr
   * @param protocolCodecs - Optional array of protocol-specific codec strings to establish
   * @returns A stream to the peer
   */
  public async rawDialPeerWithProtocols(
    peer: PeerId | MultiaddrInput,
    protocolCodecs: string[]
  ): Promise<Stream> {
    const peerDialInfo = this.getDialablePeerInfo(peer);
    return await this.libp2p.dialProtocol(peerDialInfo, protocolCodecs);
  }

  /**
   * Internal utility to extract a PeerId or Multiaddr from a peer input.
   * This is used internally by the connection manager to handle different peer input formats.
   * @internal
   */
  private getDialablePeerInfo(
    peer: PeerId | MultiaddrInput
  ): PeerId | Multiaddr {
    if (isPeerId(peer)) {
      return peer;
    } else {
      // peer is of MultiaddrInput type
      const ma = multiaddr(peer);
      const peerIdStr = ma.getPeerId();
      if (!peerIdStr) {
        throw new Error("Failed to dial multiaddr: missing peer ID");
      }
      return ma;
    }
  }

  private async attemptDnsDiscovery(): Promise<void> {
    if (this.libp2p.getConnections().length > 0) return;
    if ((await this.libp2p.peerStore.all()).length > 0) return;

    log.info("Attempting to trigger DNS discovery.");

    const dnsDiscovery = Object.values(this.libp2p.components.components).find(
      (v: unknown) => {
        if (v && v.toString) {
          return v.toString().includes(DNS_DISCOVERY_TAG);
        }

        return false;
      }
    ) as DiscoveryTrigger;

    if (!dnsDiscovery) return;

    await dnsDiscovery.findPeers();
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

  public async attemptDial(peerId: PeerId): Promise<void> {
    if (!(await this.shouldDialPeer(peerId))) return;

    if (this.currentActiveParallelDialCount >= this.options.maxParallelDials) {
      this.pendingPeerDialQueue.push(peerId);
      return;
    }

    await this.dialPeer(peerId);
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
        log.info(`Connected to peer ${evt.detail.toString()}`);

        const peerId = evt.detail;

        this.keepAliveManager.start(peerId);

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

        this.setP2PNetworkConnected();
      })();
    },
    "peer:disconnect": (evt: CustomEvent<PeerId>): void => {
      void (async () => {
        this.keepAliveManager.stop(evt.detail);
        this.setP2PNetworkDisconnected();
      })();
    },
    "browser:network": (): void => {
      this.dispatchWakuConnectionEvent();
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
    const isConnected = this.libp2p.getConnections(peerId).length > 0;
    if (isConnected) {
      log.warn(`Already connected to peer ${peerId.toString()}. Not dialing.`);
      return false;
    }

    const isSameShard = await this.isPeerOnSameShard(peerId);
    if (!isSameShard) {
      const shardInfo = await this.getPeerShardInfo(peerId);

      log.warn(
        `Discovered peer ${peerId.toString()} with ShardInfo ${shardInfo} is not part of any of the configured pubsub topics (${
          this.pubsubTopics
        }).
            Not dialing.`
      );

      return false;
    }

    const isPreferredBasedOnBootstrap =
      await this.isPeerDialableBasedOnBootstrapStatus(peerId);
    if (!isPreferredBasedOnBootstrap) {
      log.warn(
        `Peer ${peerId.toString()} is not dialable based on bootstrap status. Not dialing.`
      );
      return false;
    }

    const hasBeenDialed = this.dialAttemptsForPeer.has(peerId.toString());
    if (hasBeenDialed) {
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

    if (!isBootstrap) {
      return true;
    }

    const currentBootstrapConnections = this.libp2p
      .getConnections()
      .filter((conn) => {
        return conn.tags.find((name) => name === Tags.BOOTSTRAP);
      }).length;

    return currentBootstrapConnections < this.options.maxBootstrapPeersAllowed;
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

  public async isPeerOnSameShard(peerId: PeerId): Promise<boolean> {
    const shardInfo = await this.getPeerShardInfo(peerId);

    if (!shardInfo) {
      return true;
    }

    const pubsubTopics = shardInfoToPubsubTopics(shardInfo);

    const isTopicConfigured = pubsubTopics.some((topic) =>
      this.pubsubTopics.includes(topic)
    );

    return isTopicConfigured;
  }

  public async isPeerOnPubsubTopic(
    peerId: PeerId,
    pubsubTopic: string
  ): Promise<boolean> {
    const shardInfo = await this.getPeerShardInfo(peerId);

    if (!shardInfo) {
      return true;
    }

    const pubsubTopics = shardInfoToPubsubTopics(shardInfo);
    return pubsubTopics.some((t) => t === pubsubTopic);
  }

  private async getPeerShardInfo(
    peerId: PeerId
  ): Promise<ShardInfo | undefined> {
    const peer = await this.libp2p.peerStore.get(peerId);
    const shardInfoBytes = peer.metadata.get("shardInfo");
    if (!shardInfoBytes) return undefined;
    return decodeRelayShard(shardInfoBytes);
  }

  private startNetworkStatusListener(): void {
    try {
      globalThis.addEventListener(
        "online",
        this.onEventHandlers["browser:network"]
      );
      globalThis.addEventListener(
        "offline",
        this.onEventHandlers["browser:network"]
      );
    } catch (err) {
      log.error(`Failed to start network listener: ${err}`);
    }
  }

  private stopNetworkStatusListener(): void {
    try {
      globalThis.removeEventListener(
        "online",
        this.onEventHandlers["browser:network"]
      );
      globalThis.removeEventListener(
        "offline",
        this.onEventHandlers["browser:network"]
      );
    } catch (err) {
      log.error(`Failed to stop network listener: ${err}`);
    }
  }

  private setP2PNetworkConnected(): void {
    if (!this.isP2PNetworkConnected) {
      this.isP2PNetworkConnected = true;
      this.dispatchWakuConnectionEvent();
    }
  }

  private setP2PNetworkDisconnected(): void {
    if (
      this.isP2PNetworkConnected &&
      this.libp2p.getConnections().length === 0
    ) {
      this.isP2PNetworkConnected = false;
      this.dispatchWakuConnectionEvent();
    }
  }

  private dispatchWakuConnectionEvent(): void {
    this.dispatchEvent(
      new CustomEvent<boolean>(EConnectionStateEvents.CONNECTION_STATUS, {
        detail: this.isConnected()
      })
    );
  }
}
