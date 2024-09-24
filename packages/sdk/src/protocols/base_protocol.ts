import type { Peer, PeerId } from "@libp2p/interface";
import { ConnectionManager } from "@waku/core";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import {
  IBaseProtocolSDK,
  IHealthManager,
  PeerIdStr,
  ProtocolUseOptions
} from "@waku/interfaces";
import { delay, Logger } from "@waku/utils";

interface Options {
  numPeersToUse?: number;
  maintainPeersInterval?: number;
}
///TODO: update HealthManager

const DEFAULT_NUM_PEERS_TO_USE = 2;
const DEFAULT_MAINTAIN_PEERS_INTERVAL = 30_000;

export class BaseProtocolSDK implements IBaseProtocolSDK {
  private peerManager: PeerManager;
  public readonly numPeersToUse: number;
  private peers: Map<PeerIdStr, Peer> = new Map();
  private maintainPeersIntervalId: ReturnType<
    typeof window.setInterval
  > | null = null;
  private log: Logger;

  private maintainPeersLock = false;
  private readonly renewPeersLocker = new RenewPeerLocker(
    RENEW_TIME_LOCK_DURATION
  );

  public constructor(
    protected core: BaseProtocol,
    protected connectionManager: ConnectionManager,
    options: Options
  ) {
    this.log = new Logger(`sdk:${core.multicodec}`);

    this.peerManager = new PeerManager(connectionManager, core, this.log);

    this.numPeersToUse = options?.numPeersToUse ?? DEFAULT_NUM_PEERS_TO_USE;
    const maintainPeersInterval =
      options?.maintainPeersInterval ?? DEFAULT_MAINTAIN_PEERS_INTERVAL;

    void this.setupEventListeners();
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
  public async renewPeer(peerToDisconnect: PeerId): Promise<Peer> {
    this.log.info(`Renewing peer ${peerToDisconnect}`);

    await this.connectionManager.dropConnection(peerToDisconnect);

    const peer = (await this.findAndAddPeers(1))[0];
    if (!peer) {
      this.log.error(
        "Failed to find a new peer to replace the disconnected one."
      );
    }

    const updatedPeers = this.peers.filter(
      (peer) => !peer.id.equals(peerToDisconnect)
    );
    this.updatePeers(updatedPeers);

    this.log.info(
      `Peer ${peerToDisconnect} disconnected and removed from the peer list`
    );

    this.renewPeersLocker.lock(peerToDisconnect);

    return peer;
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

  private setupEventListeners(): void {
    this.core.addLibp2pEventListener(
      "peer:connect",
      () => void this.confirmPeers()
    );
    this.core.addLibp2pEventListener(
      "peer:disconnect",
      () => void this.confirmPeers()
    );
  }

  /**
   * Checks if there are sufficient peers to send a message to.
   * If `forceUseAllPeers` is `false` (default), returns `true` if there are any connected peers.
   * If `forceUseAllPeers` is `true`, attempts to connect to `numPeersToUse` peers.
   * @param options Optional options object
   * @param options.forceUseAllPeers Optional flag to force connecting to `numPeersToUse` peers (default: false)
   * @param options.maxAttempts Optional maximum number of attempts to reach the required number of peers (default: 3)
   * @returns `true` if the required number of peers are connected, `false` otherwise
   */
  protected async hasPeers(
    options: Partial<ProtocolUseOptions> = {}
  ): Promise<boolean> {
    const { forceUseAllPeers = false, maxAttempts = 3 } = options;

    if (!forceUseAllPeers && this.connectedPeers.length > 0) return true;

    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      if (await this.maintainPeers()) {
        if (this.peers.size < this.numPeersToUse) {
          this.log.warn(
            `Found only ${this.peers.size} peers, expected ${this.numPeersToUse}`
          );
        }
        return true;
      }
      if (!autoRetry) {
        return false;
      }
      //TODO: handle autoRetry
    }

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      await this.maintainPeers();

      if (this.connectedPeers.length >= this.numPeersToUse) {
        return true;
      }

      this.log.warn(
        `Found only ${this.connectedPeers.length} peers, expected ${this.numPeersToUse}. Retrying...`
      );
    }

    this.log.error("Failed to find required number of peers");
    return false;
  }

  /**
   * Starts an interval to maintain the peers list to `numPeersToUse`.
   * @param interval The interval in milliseconds to maintain the peers.
   */
  private async startMaintainPeersInterval(interval: number): Promise<void> {
    this.log.info("Starting maintain peers interval");
    try {
      // await this.maintainPeers();
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
    if (this.maintainPeersLock) {
      return false;
    }

    this.maintainPeersLock = true;
    this.log.info(`Maintaining peers, current count: ${this.peers.length}`);
    try {
      await this.confirmPeers();
      this.log.info(`Maintaining peers, current count: ${this.peers.size}`);

      const numPeersToAdd = this.numPeersToUse - this.peers.size;
      if (numPeersToAdd > 0) {
        await this.peerManager.findAndAddPeers(numPeersToAdd);
      } else {
        await this.peerManager.removeExcessPeers(Math.abs(numPeersToAdd));
      }

      this.log.info(
        `Peer maintenance completed, current count: ${this.peers.size}`
      );
      this.renewPeersLocker.cleanUnlocked();
      return true;
    } catch (error) {
      if (error instanceof Error) {
        this.log.error("Error during peer maintenance", {
          error: error.message,
          stack: error.stack
        });
      } else {
        this.log.error("Error during peer maintenance", {
          error: String(error)
        });
      }
      return false;
    } finally {
      this.maintainPeersLock = false;
    }
  }

  /**
   * Finds and adds new peers to the peers list.
   * @param numPeers The number of peers to find and add.
   */
  private async findAndAddPeers(numPeers: number): Promise<Peer[]> {
    this.log.info(`Finding and adding ${numPeers} new peers`);
    try {
      const additionalPeers = await this.findAdditionalPeers(numPeers);
      const dials = additionalPeers.map((peer) =>
        this.connectionManager.attemptDial(peer.id)
      );

      await Promise.all(dials);

      additionalPeers.forEach((peer) =>
        this.peers.set(peer.id.toString(), peer)
      );
      this.updatePeers(this.peers);

      this.log.info(
        `Added ${additionalPeers.length} new peers, total peers: ${this.peers.size}`
      );
      return additionalPeers;
    } catch (error) {
      this.log.error("Error finding and adding new peers:", error);
      throw error;
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
