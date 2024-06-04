import type { Peer, PeerId } from "@libp2p/interface";
import { ConnectionManager } from "@waku/core";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import { IBaseProtocolSDK } from "@waku/interfaces";
import { Logger } from "@waku/utils";

interface Options {
  numPeersToUse?: number;
  maintainPeersInterval?: number;
}

const DEFAULT_NUM_PEERS_TO_USE = 3;
const DEFAULT_MAINTAIN_PEERS_INTERVAL = 30_000;

export class BaseProtocolSDK implements IBaseProtocolSDK {
  public readonly numPeersToUse: number;
  private peers: Peer[] = [];
  private maintainPeersIntervalId: ReturnType<
    typeof window.setInterval
  > | null = null;
  log: Logger;

  private maintainPeersLock = false;

  constructor(
    protected core: BaseProtocol,
    private connectionManager: ConnectionManager,
    options: Options
  ) {
    this.log = new Logger(`sdk:${core.multicodec}`);
    this.numPeersToUse = options?.numPeersToUse ?? DEFAULT_NUM_PEERS_TO_USE;
    const maintainPeersInterval =
      options?.maintainPeersInterval ?? DEFAULT_MAINTAIN_PEERS_INTERVAL;

    /**
     * Trigger maintainPeers when a new peer is identified.
     * This is useful to make the process of finding and adding new peers more dynamic and efficient,
     * instead of relying on the interval only.
     */
    this.core.addLibp2pEventListener("peer:identify", (evt) => {
      const { protocols } = evt.detail;
      if (protocols.includes(core.multicodec)) {
        void this.maintainPeers();
      }
    });
    void this.startMaintainPeersInterval(maintainPeersInterval);
  }

  get connectedPeers(): Peer[] {
    return this.peers;
  }

  /**
   * Disconnects from a peer and tries to find a new one to replace it.
   * @param peerToDisconnect The peer to disconnect from.
   */
  public async renewPeer(peerToDisconnect: PeerId): Promise<void> {
    this.log.info(`Renewing peer ${peerToDisconnect}`);
    try {
      await this.connectionManager.dropConnection(peerToDisconnect);
      this.peers = this.peers.filter((peer) => peer.id !== peerToDisconnect);
      this.log.info(
        `Peer ${peerToDisconnect} disconnected and removed from the peer list`
      );

      await this.findAndAddPeers(1);
    } catch (error) {
      this.log.info(
        "Peer renewal failed, relying on the interval to find a new peer"
      );
    }
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

  /**
   * Checks if there are peers to send a message to.
   * If there are no peers, tries to find new peers.
   * If no peers are found, returns false.
   * If peers are found, returns true.
   */
  protected hasPeers = async (): Promise<boolean> => {
    if (this.connectedPeers.length > 0) return true;

    let success = await this.maintainPeers();
    let attempts = 0;
    while (!success) {
      attempts++;
      success = await this.maintainPeers();
      if (attempts > 3) {
        if (this.peers.length === 0) {
          this.log.error("Failed to find peers to send message to");
          return false;
        } else {
          this.log.warn(
            `Found only ${this.peers.length} peers, expected ${this.numPeersToUse}`
          );
          return true;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return true;
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
    if (this.maintainPeersLock) {
      return false;
    }

    this.maintainPeersLock = true;
    this.log.info(`Maintaining peers, current count: ${this.peers.length}`);
    try {
      const numPeersToAdd = this.numPeersToUse - this.peers.length;
      if (numPeersToAdd > 0) {
        await this.findAndAddPeers(numPeersToAdd);
      }
      this.log.info(
        `Peer maintenance completed, current count: ${this.peers.length}`
      );
    } finally {
      this.maintainPeersLock = false;
    }
    return true;
  }

  /**
   * Finds and adds new peers to the peers list.
   * @param numPeers The number of peers to find and add.
   */
  private async findAndAddPeers(numPeers: number): Promise<void> {
    this.log.info(`Finding and adding ${numPeers} new peers`);
    try {
      const additionalPeers = await this.findAdditionalPeers(numPeers);
      this.peers = [...this.peers, ...additionalPeers];
      this.log.info(
        `Added ${additionalPeers.length} new peers, total peers: ${this.peers.length}`
      );
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
      let newPeers = await this.core.getPeers({
        maxBootstrapPeers: 0,
        numPeers: numPeers
      });

      if (newPeers.length === 0) {
        this.log.warn("No new peers found, trying with bootstrap peers");
        newPeers = await this.core.getPeers({
          maxBootstrapPeers: numPeers,
          numPeers: numPeers
        });
      }

      newPeers = newPeers.filter(
        (peer) => this.peers.some((p) => p.id === peer.id) === false
      );
      return newPeers;
    } catch (error) {
      this.log.error("Error finding additional peers:", error);
      throw error;
    }
  }
}
