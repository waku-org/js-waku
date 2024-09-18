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
import { Mutex } from "async-mutex";

interface Options {
  numPeersToUse?: number;
  maintainPeersInterval?: number;
}

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

    this.peerManager = new PeerManager(connectionManager, core, this.log);

    this.numPeersToUse = options?.numPeersToUse ?? DEFAULT_NUM_PEERS_TO_USE;
    const maintainPeersInterval =
      options?.maintainPeersInterval ?? DEFAULT_MAINTAIN_PEERS_INTERVAL;

    this.log.info(
      `Initializing BaseProtocolSDK with numPeersToUse: ${this.numPeersToUse}, maintainPeersInterval: ${maintainPeersInterval}ms`
    );
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
    this.log.info(`Attempting to renew peer ${peerToDisconnect}`);

      await this.connectionManager.dropConnection(peerToDisconnect);

    const updatedPeers = this.peers.filter(
      (peer) => !peer.id.equals(peerToDisconnect)
    );
    this.updatePeers(updatedPeers);

    this.log.info(
      `Peer ${peerToDisconnect} disconnected and removed from the peer list`
    );

    const newPeer = await this.findAndAddPeers(1);
    if (newPeer.length === 0) {
      this.log.error(
        "Failed to find a new peer to replace the disconnected one"
      );
      return undefined;
    }

    this.renewPeersLocker.lock(peerToDisconnect);

    return newPeer[0];
  }

  /**
   * Stops the maintain peers interval.
   */
  public stopMaintainPeersInterval(): void {
    if (this.maintainPeersIntervalId) {
      clearInterval(this.maintainPeersIntervalId);
      this.maintainPeersIntervalId = null;
      this.log.info("Maintain peers interval stopped");
    } else {
      this.log.debug("Maintain peers interval was not running");
    }
  }

  //TODO: validate if adding event listeners for peer connect and disconnect is needed
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
      if (!autoRetry) {
        return false;
      }
      //TODO: handle autoRetry
    }

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      this.log.debug(
        `Attempt ${attempts + 1}/${maxAttempts} to reach required number of peers`
      );
      await this.maintainPeers();

      if (this.connectedPeers.length >= this.numPeersToUse) {
        this.log.info(
          `Required number of peers (${this.numPeersToUse}) reached`
        );
        return true;
      }

      this.log.warn(
        `Found only ${this.connectedPeers.length}/${this.numPeersToUse} required peers. Retrying...`
      );
    }

    this.log.error(
      `Failed to find required number of peers (${this.numPeersToUse}) after ${maxAttempts} attempts`
    );
    return false;
  }

  /**
   * Starts an interval to maintain the peers list to `numPeersToUse`.
   * @param interval The interval in milliseconds to maintain the peers.
   */
  private async startMaintainPeersInterval(interval: number): Promise<void> {
    this.log.info(
      `Starting maintain peers interval with ${interval}ms interval`
    );
    try {
      // await this.maintainPeers();
      this.maintainPeersIntervalId = setInterval(() => {
        this.log.debug("Running scheduled peer maintenance");
        this.maintainPeers().catch((error) => {
          this.log.error("Error during scheduled peer maintenance:", error);
        });
      }, interval);
      this.log.info("Maintain peers interval started successfully");
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

    this.maintainPeersLock = true;
    await this.confirmPeers();
    this.log.info(`Maintaining peers, current count: ${this.peers.length}`);
    try {
      await this.confirmPeers();
      this.log.info(`Maintaining peers, current count: ${this.peers.size}`);

      const numPeersToAdd = this.numPeersToUse - this.peers.size;
      if (numPeersToAdd > 0) {
        this.log.info(`Attempting to add ${numPeersToAdd} peer(s)`);
        await this.peerManager.findAndAddPeers(numPeersToAdd);
      } else {
        this.log.info(
          `Attempting to remove ${Math.abs(numPeersToAdd)} excess peer(s)`
        );
        await this.peerManager.removeExcessPeers(Math.abs(numPeersToAdd));
      }
    });
  }

  private async confirmPeers(): Promise<void> {
    const connectedPeers = await this.core.connectedPeers();
    const currentPeers = this.peers;
    const peersToAdd = connectedPeers.filter(
      (p) => !currentPeers.some((cp) => cp.id.equals(p.id))
    );
    const peersToRemove = currentPeers.filter(
      (p) => !connectedPeers.some((cp) => cp.id.equals(p.id))
    );

    peersToAdd.forEach((p) => this.peers.push(p));
    peersToRemove.forEach((p) => {
      const index = this.peers.findIndex((cp) => cp.id.equals(p.id));
      if (index !== -1) this.peers.splice(index, 1);
    });

    this.updatePeers(this.peers);
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
