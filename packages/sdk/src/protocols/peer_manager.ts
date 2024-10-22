import { Peer, PeerId } from "@libp2p/interface";
import { ConnectionManager } from "@waku/core";
import { ProtocolUseOptions } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { Mutex } from "async-mutex";

const log = new Logger("peer-manager");

const DEFAULT_NUM_PEERS_TO_USE = 2;
const DEFAULT_MAINTAIN_PEERS_INTERVAL = 30_000;

type PeerManagerConfig = {
  numPeersToUse?: number;
  maintainPeersIntervalMs?: number;
};

type PeerManagerParams = {
  config?: PeerManagerConfig;
  connectionManager: ConnectionManager;
};

export class PeerManager {
  private peers: Map<string, Peer> = new Map();

  private readMutex = new Mutex();
  private writeMutex = new Mutex();
  private writeLockHolder: string | null = null;

  private readonly numPeersToUse: number;
  private readonly maintainPeersIntervalMs: number;
  private readonly connectionManager: ConnectionManager;

  private maintainPeersIntervalId: ReturnType<
    typeof window.setInterval
  > | null = null;

  public constructor(params: PeerManagerParams) {
    this.numPeersToUse =
      params?.config?.numPeersToUse || DEFAULT_NUM_PEERS_TO_USE;
    this.maintainPeersIntervalMs =
      params?.config?.maintainPeersIntervalMs ||
      DEFAULT_MAINTAIN_PEERS_INTERVAL;

    this.connectionManager = params.connectionManager;

    void this.startMaintainPeersInterval(this.maintainPeersIntervalMs);
  }

  /**
   * Disconnects from a peer and tries to find a new one to replace it.
   * @param peerToDisconnect The peer to disconnect from.
   * @returns The new peer that was found and connected to.
   */
  public async renewPeer(peerToDisconnect: PeerId): Promise<Peer | undefined> {
    log.info(`Attempting to renew peer ${peerToDisconnect}`);

    const newPeer = await this.findPeers(1);
    if (newPeer.length === 0) {
      log.error("Failed to find a new peer to replace the disconnected one");
      return undefined;
    }

    await this.removePeer(peerToDisconnect);
    await this.addPeer(newPeer[0]);

    log.info(`Successfully renewed peer. New peer: ${newPeer[0].id}`);

    return newPeer[0];
  }

  /**
   * Stops the maintain peers interval.
   */
  public stopMaintainPeersInterval(): void {
    if (this.maintainPeersIntervalId) {
      clearInterval(this.maintainPeersIntervalId);
      this.maintainPeersIntervalId = null;
      log.info("Maintain peers interval stopped");
    } else {
      log.info("Maintain peers interval was not running");
    }
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
  public async hasPeersWithMaintain(
    options: Partial<ProtocolUseOptions> = {}
  ): Promise<boolean> {
    const { forceUseAllPeers = false, maxAttempts = 3 } = options;

    log.info(
      `Checking for peers. forceUseAllPeers: ${forceUseAllPeers}, maxAttempts: ${maxAttempts}`
    );

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      log.info(
        `Attempt ${attempts + 1}/${maxAttempts} to reach required number of peers`
      );
      await this.maintainPeers();

      if (!forceUseAllPeers && this.connectedPeers.length > 0) {
        log.info(
          `At least one peer connected (${this.connectedPeers.length}), not forcing use of all peers`
        );
        return true;
      }

      if (this.connectedPeers.length >= this.numPeersToUse) {
        log.info(`Required number of peers (${this.numPeersToUse}) reached`);
        return true;
      }

      log.warn(
        `Found only ${this.connectedPeers.length}/${this.numPeersToUse} required peers. Retrying...`
      );
    }

    log.error(
      `Failed to find required number of peers (${this.numPeersToUse}) after ${maxAttempts} attempts`
    );
    return false;
  }

  /**
   * Starts an interval to maintain the peers list to `numPeersToUse`.
   * @param interval The interval in milliseconds to maintain the peers.
   */
  private async startMaintainPeersInterval(interval: number): Promise<void> {
    log.info(`Starting maintain peers interval with ${interval}ms interval`);
    try {
      this.maintainPeersIntervalId = setInterval(() => {
        log.info("Running scheduled peer maintenance");
        this.maintainPeers().catch((error) => {
          log.error("Error during scheduled peer maintenance:", error);
        });
      }, interval);
      log.info("Maintain peers interval started successfully");
    } catch (error) {
      log.error("Error starting maintain peers interval:", error);
      throw error;
    }
  }

  /**
   * Maintains the peers list to `numPeersToUse`.
   */
  private async maintainPeers(): Promise<void> {
    try {
      const currentPeerCount = await this.getPeerCount();
      const numPeersToAdd = this.numPeersToUse - currentPeerCount;

      log.info(
        `Current peer count: ${currentPeerCount}, target: ${this.numPeersToUse}`
      );

      if (numPeersToAdd === 0) {
        log.info("Peer count is at target, no maintenance required");
        return;
      }

      if (numPeersToAdd > 0) {
        log.info(`Attempting to add ${numPeersToAdd} peer(s)`);
        await this.findAndAddPeers(numPeersToAdd);
      } else {
        log.info(
          `Attempting to remove ${Math.abs(numPeersToAdd)} excess peer(s)`
        );
        await this.removeExcessPeers(Math.abs(numPeersToAdd));
      }

      const finalPeerCount = await this.getPeerCount();
      log.info(
        `Peer maintenance completed. Initial count: ${currentPeerCount}, Final count: ${finalPeerCount}`
      );
    } catch (error) {
      log.error("Error during peer maintenance", { error });
    }
  }

  public getWriteLockHolder(): string | null {
    return this.writeLockHolder;
  }

  public get connectedPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  public getPeers(): Peer[] {
    return this.connectedPeers.slice(0, this.numPeersToUse);
  }

  public async addPeer(peer: Peer): Promise<void> {
    return this.writeMutex.runExclusive(async () => {
      this.writeLockHolder = `addPeer: ${peer.id.toString()}`;
      await this.connectionManager.attemptDial(peer.id);
      this.peers.set(peer.id.toString(), peer);
      log.info(`Added and dialed peer: ${peer.id.toString()}`);
      this.writeLockHolder = null;
    });
  }

  public async removePeer(peerId: PeerId): Promise<void> {
    return this.writeMutex.runExclusive(() => {
      this.writeLockHolder = `removePeer: ${peerId.toString()}`;
      this.peers.delete(peerId.toString());
      log.info(`Removed peer: ${peerId.toString()}`);
      this.writeLockHolder = null;
    });
  }

  public async getPeerCount(): Promise<number> {
    return this.readMutex.runExclusive(() => this.peers.size);
  }

  public async hasPeers(): Promise<boolean> {
    return this.readMutex.runExclusive(() => this.peers.size > 0);
  }

  public async removeExcessPeers(excessPeers: number): Promise<void> {
    log.info(`Removing ${excessPeers} excess peer(s)`);
    const peersToRemove = Array.from(this.peers.values()).slice(0, excessPeers);
    for (const peer of peersToRemove) {
      await this.removePeer(peer.id);
    }
  }

  /**
   * Finds and adds new peers to the peers list.
   * @param numPeers The number of peers to find and add.
   */
  public async findAndAddPeers(numPeers: number): Promise<Peer[]> {
    const additionalPeers = await this.findPeers(numPeers);
    if (additionalPeers.length === 0) {
      log.warn("No additional peers found");
      return [];
    }
    return this.addMultiplePeers(additionalPeers);
  }

  /**
   * Finds additional peers.
   * @param numPeers The number of peers to find.
   */
  public async findPeers(numPeers: number): Promise<Peer[]> {
    const connectedPeers = await this.connectionManager.getConnectedPeers();

    return this.readMutex.runExclusive(async () => {
      const newPeers = connectedPeers
        .filter((peer) => !this.peers.has(peer.id.toString()))
        .slice(0, numPeers);

      return newPeers;
    });
  }

  public async addMultiplePeers(peers: Peer[]): Promise<Peer[]> {
    const addedPeers: Peer[] = [];
    for (const peer of peers) {
      await this.addPeer(peer);
      addedPeers.push(peer);
    }
    return addedPeers;
  }
}
