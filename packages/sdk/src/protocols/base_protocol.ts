import type { Peer, PeerId } from "@libp2p/interface";
import { ConnectionManager } from "@waku/core";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import { IBaseProtocolSDK, ProtocolUseOptions } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { PeerManager } from "./peer_manager.js";

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
  private maintainPeersIntervalId: ReturnType<
    typeof window.setInterval
  > | null = null;
  private log: Logger;

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

    // void this.setupEventListeners();
    void this.startMaintainPeersInterval(maintainPeersInterval);
  }

  public get connectedPeers(): Peer[] {
    return this.peerManager.getPeers();
  }

  /**
   * Disconnects from a peer and tries to find a new one to replace it.
   * @param peerToDisconnect The peer to disconnect from.
   * @returns The new peer that was found and connected to.
   */
  public async renewPeer(peerToDisconnect: PeerId): Promise<Peer | undefined> {
    this.log.info(`Renewing peer ${peerToDisconnect}`);

    const success = await this.peerManager.disconnectPeer(peerToDisconnect);
    if (!success) return undefined;

    const newPeer = await this.peerManager.findAndAddPeers(1);
    if (newPeer.length === 0) {
      this.log.error(
        "Failed to find a new peer to replace the disconnected one."
      );
      return undefined;
    }

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
    }
  }

  // private setupEventListeners(): void {
  //   this.core.addLibp2pEventListener(
  //     "peer:connect",
  //     () => void this.maintainPeers()
  //   );
  //   this.core.addLibp2pEventListener(
  //     "peer:disconnect",
  //     () => void this.maintainPeers()
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
  protected async hasPeers(
    options: Partial<ProtocolUseOptions> = {}
  ): Promise<boolean> {
    const {
      autoRetry = false,
      forceUseAllPeers = false,
      maxAttempts = 3
    } = options;

    if (!forceUseAllPeers && this.connectedPeers.length > 0) {
      return true;
    }

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const success = await this.maintainPeers();
      if (success) {
        if (this.connectedPeers.length < this.numPeersToUse) {
          this.log.warn(
            `Found only ${this.connectedPeers.length} peers, expected ${this.numPeersToUse}`
          );
        }
        return true;
      }
      if (!autoRetry) {
        return false;
      }
      //TODO: handle autoRetry
    }

    this.log.error("Failed to find peers to send message to");
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
    try {
      const currentPeerCount = await this.peerManager.getPeerCount();
      const numPeersToAdd = this.numPeersToUse - currentPeerCount;

      if (numPeersToAdd === 0) {
        this.log.info("No maintenance required, peer count is sufficient");
        return true;
      }

      this.log.info(`Maintaining peers, current count: ${currentPeerCount}`);

      if (numPeersToAdd > 0) {
        await this.peerManager.findAndAddPeers(numPeersToAdd);
      } else {
        await this.peerManager.removeExcessPeers(Math.abs(numPeersToAdd));
      }

      const finalPeerCount = await this.peerManager.getPeerCount();
      this.log.info(
        `Peer maintenance completed, current count: ${finalPeerCount}`
      );
      return finalPeerCount >= this.numPeersToUse;
    } catch (error) {
      this.log.error("Error during peer maintenance", { error });
      return false;
    }
  }
}
