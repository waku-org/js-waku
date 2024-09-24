import type { Peer, PeerId } from "@libp2p/interface";
import { ConnectionManager, getHealthManager } from "@waku/core";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import {
  IBaseProtocolSDK,
  IHealthManager,
  PeerIdStr,
  ProtocolUseOptions
} from "@waku/interfaces";
import { delay, Logger } from "@waku/utils";
import { Mutex } from "async-mutex";

interface Options {
  numPeersToUse?: number;
  maintainPeersInterval?: number;
}

const RENEW_TIME_LOCK_DURATION = 30 * 1000;
export const DEFAULT_NUM_PEERS_TO_USE = 2;
const DEFAULT_MAINTAIN_PEERS_INTERVAL = 30_000;

export class BaseProtocolSDK implements IBaseProtocolSDK {
  protected healthManager: IHealthManager;
  public readonly numPeersToUse: number;
  private peers: Map<PeerIdStr, Peer> = new Map();
  private maintainPeersIntervalId: ReturnType<
    typeof window.setInterval
  > | null = null;
  private log: Logger;

  private readonly renewPeersLocker = new RenewPeerLocker(
    RENEW_TIME_LOCK_DURATION
  );

  private peersMutex = new Mutex();

  public constructor(
    protected core: BaseProtocol,
    protected connectionManager: ConnectionManager,
    options: Options
  ) {
    this.log = new Logger(`sdk:${core.multicodec}`);

    this.healthManager = getHealthManager();

    this.numPeersToUse = options?.numPeersToUse ?? DEFAULT_NUM_PEERS_TO_USE;
    const maintainPeersInterval =
      options?.maintainPeersInterval ?? DEFAULT_MAINTAIN_PEERS_INTERVAL;

    // void this.setupEventListeners();
    void this.startMaintainPeersInterval(maintainPeersInterval);
  }

  public get connectedPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Disconnects from a peer and tries to find a new one to replace it.
   * @param peerToDisconnect The peer to disconnect from.
   * @returns The new peer that was found and connected to.
   */
  public async renewPeer(peerToDisconnect: PeerId): Promise<Peer | undefined> {
    return this.peersMutex.runExclusive(async () => {
      this.log.info(`Renewing peer ${peerToDisconnect}`);

      await this.connectionManager.dropConnection(peerToDisconnect);

      this.peers.delete(peerToDisconnect.toString());
      this.updatePeers(new Map(this.peers));

      this.log.info(
        `Peer ${peerToDisconnect} disconnected and removed from the peer list`
      );

      const newPeer = await this.findAndAddPeers(1);
      if (newPeer.length === 0) {
        this.log.error(
          "Failed to find a new peer to replace the disconnected one."
        );
        return undefined;
      }

      this.renewPeersLocker.lock(peerToDisconnect);

      return newPeer[0];
    });
  }

  /**
   * Stops the maintain peers interval.
   */
  public stopMaintainPeersInterval(): void {
    if (this.maintainPeersIntervalId) {
      clearInterval(this.maintainPeersIntervalId);
      this.maintainPeersIntervalId = null;
      this.log.info("Maintain peers interval stopped");
    }
  }

  // private setupEventListeners(): void {
  //   this.core.addLibp2pEventListener(
  //     "peer:connect",
  //     () => void this.confirmPeers()
  //   );
  //   this.core.addLibp2pEventListener(
  //     "peer:disconnect",
  //     () => void this.confirmPeers()
  //   );
  // }

  /**
   * Checks if there are peers to send a message to.
   * If `forceUseAllPeers` is `false` (default) and there are connected peers, returns `true`.
   * If `forceUseAllPeers` is `true` or there are no connected peers, tries to find new peers from the ConnectionManager.
   * If `autoRetry` is `false`, returns `false` if no peers are found.
   * If `autoRetry` is `true`, tries to find new peers from the ConnectionManager with exponential backoff.
   * Returns `true` if peers are found, `false` otherwise.
   * @param options Optional options object
   * @param options.autoRetry Optional flag to enable auto-retry with exponential backoff (default: false)
   * @param options.forceUseAllPeers Optional flag to force using all available peers (default: false)
   * @param options.initialDelay Optional initial delay in milliseconds for exponential backoff (default: 10)
   * @param options.maxAttempts Optional maximum number of attempts for exponential backoff (default: 3)
   * @param options.maxDelay Optional maximum delay in milliseconds for exponential backoff (default: 100)
   */
  protected hasPeers = async (
    options: Partial<ProtocolUseOptions> = {}
  ): Promise<boolean> => {
    const {
      autoRetry = false,
      forceUseAllPeers = false,
      initialDelay = 10,
      maxAttempts = 3,
      maxDelay = 100
    } = options;

    let needsMaintenance: boolean;
    let currentPeerCount: number;

    const release = await this.peersMutex.acquire();
    try {
      currentPeerCount = this.connectedPeers.length;
      needsMaintenance = forceUseAllPeers || currentPeerCount === 0;
    } finally {
      release();
    }

    if (!needsMaintenance) return true;

    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      if (await this.maintainPeers()) {
        const finalRelease = await this.peersMutex.acquire();
        try {
          if (this.peers.size < this.numPeersToUse) {
            this.log.warn(
              `Found only ${this.peers.size} peers, expected ${this.numPeersToUse}`
            );
          }
          return true;
        } finally {
          finalRelease();
        }
      }
      if (!autoRetry) return false;
      const delayMs = Math.min(
        initialDelay * Math.pow(2, attempts - 1),
        maxDelay
      );
      await delay(delayMs);
    }

    this.log.error("Failed to find peers to send message to");
    return false;
  };

  /**
   * Starts an interval to maintain the peers list to `numPeersToUse`.
   * @param interval The interval in milliseconds to maintain the peers.
   */
  private async startMaintainPeersInterval(interval: number): Promise<void> {
    this.log.info("Starting maintain peers interval");
    try {
      await this.maintainPeers();
      this.maintainPeersIntervalId = setInterval(() => {
        this.maintainPeers().catch((error) => {
          this.log.error("Error during maintain peers interval:", error);
        });
      }, interval);
      this.log.info(
        `Maintain peers interval started with interval ${interval}ms`
      );
    } catch (error) {
      this.log.error("Error starting maintain peers interval:", error);
      throw error;
    }
  }

  /**
   * Maintains the peers list to `numPeersToUse`.
   */
  private async maintainPeers(): Promise<boolean> {
    try {
      await this.confirmPeers();

      const numPeersToAdd = await this.peersMutex.runExclusive(() => {
        this.log.info(`Maintaining peers, current count: ${this.peers.size}`);
        return this.numPeersToUse - this.peers.size;
      });

      if (numPeersToAdd > 0) {
        await this.findAndAddPeers(numPeersToAdd);
      }

      if (numPeersToAdd < 0) {
        this.log.warn(`
          Peer maintenance completed, but there are more than ${this.numPeersToUse} peers.
          This should not happen.
        `);
      }

      await this.peersMutex.runExclusive(() => {
        this.log.info(
          `Peer maintenance completed, current count: ${this.peers.size}`
        );
        this.renewPeersLocker.cleanUnlocked();
      });

      return true;
    } catch (error) {
      this.log.error("Error during peer maintenance", error);
      return false;
    }
  }

  private async confirmPeers(): Promise<void> {
    const connectedPeers = await this.core.connectedPeers();
    const currentPeerIds = new Set(this.peers.keys());

    // Peers to add (connected but not in our list)
    const peersToAdd = connectedPeers.filter(
      (p) => !currentPeerIds.has(p.id.toString())
    );

    // Peers to remove (in our list but not connected)
    const peersToRemove = Array.from(this.peers.values()).filter(
      (p) => !connectedPeers.some((cp) => cp.id.equals(p.id))
    );

    await this.peersMutex.runExclusive(async () => {
      // Add new peers
      for (const peer of peersToAdd) {
        this.peers.set(peer.id.toString(), peer);
        this.log.info(`Added new peer: ${peer.id.toString()}`);
      }

      // Remove disconnected peers
      for (const peer of peersToRemove) {
        this.peers.delete(peer.id.toString());
        this.log.info(`Removed disconnected peer: ${peer.id.toString()}`);
      }

      this.updatePeers(new Map(this.peers));
      this.log.info(`Peers confirmed. Current count: ${this.peers.size}`);
    });
  }

  /**
   * Finds and adds new peers to the peers list.
   * @param numPeers The number of peers to find and add.
   */
  private async findAndAddPeers(numPeers: number): Promise<Peer[]> {
    let newPeers: Peer[];
    const release = await this.peersMutex.acquire();
    try {
      this.log.info(`Finding and adding ${numPeers} new peers`);
      newPeers = await this.findAdditionalPeers(numPeers);
    } finally {
      release();
    }

    const dials = await Promise.all(
      newPeers.map((peer) => this.connectionManager.attemptDial(peer.id))
    );

    const finalRelease = await this.peersMutex.acquire();
    try {
      const successfulPeers = newPeers.filter((_, index) => dials[index]);
      successfulPeers.forEach((peer) =>
        this.peers.set(peer.id.toString(), peer)
      );
      this.updatePeers(new Map(this.peers));
      this.log.info(
        `Added ${successfulPeers.length} new peers, total peers: ${this.peers.size}`
      );
      return successfulPeers;
    } finally {
      finalRelease();
    }
  }

  /**
   * Finds additional peers.
   * Attempts to find peers without using bootstrap peers first,
   * If no peers are found,
   * tries with bootstrap peers.
   * @param numPeers The number of peers to find.
   */
  private async findAdditionalPeers(numPeers: number): Promise<Peer[]> {
    this.log.info(`Finding ${numPeers} additional peers`);
    try {
      let newPeers = await this.core.allPeers();

      if (newPeers.length === 0) {
        this.log.warn("No new peers found.");
      }

      newPeers = newPeers
        .filter((peer) => !this.peers.has(peer.id.toString()))
        .filter((peer) => !this.renewPeersLocker.isLocked(peer.id))
        .slice(0, numPeers);

      return newPeers;
    } catch (error) {
      this.log.error("Error finding additional peers:", error);
      throw error;
    }
  }

  private updatePeers(peers: Map<PeerIdStr, Peer>): void {
    this.peers = peers;
    this.healthManager.updateProtocolHealth(
      this.core.multicodec,
      this.peers.size
    );
  }
}

class RenewPeerLocker {
  private readonly peers: Map<string, number> = new Map();

  public constructor(private lockDuration: number) {}

  public lock(id: PeerId): void {
    this.peers.set(id.toString(), Date.now());
  }

  public isLocked(id: PeerId): boolean {
    const time = this.peers.get(id.toString());

    if (time && !this.isTimeUnlocked(time)) {
      return true;
    }

    return false;
  }

  public cleanUnlocked(): void {
    Array.from(this.peers.entries()).forEach(([id, lock]) => {
      if (this.isTimeUnlocked(lock)) {
        this.peers.delete(id.toString());
      }
    });
  }

  private isTimeUnlocked(time: number): boolean {
    return Date.now() - time >= this.lockDuration;
  }
}
