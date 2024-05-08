import type { Peer, PeerId } from "@libp2p/interface";
import { ConnectionManager } from "@waku/core";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import { IBaseProtocolSDK } from "@waku/interfaces";
import { Logger } from "@waku/utils";

interface Options {
  numPeersToUse?: number;
  maintainPeersInterval?: number;
}

const log = new Logger("sdk:base-protocol");

const DEFAULT_NUM_PEERS_TO_USE = 3;
const DEFAULT_MAINTAIN_PEERS_INTERVAL = 60000;

export class BaseProtocolSDK implements IBaseProtocolSDK {
  public readonly numPeersToUse: number;
  public peers: Peer[] = [];
  private maintainPeersIntervalId: NodeJS.Timeout | undefined;

  constructor(
    protected core: BaseProtocol,
    private connectionManager: ConnectionManager,
    options: Options
  ) {
    this.numPeersToUse = options?.numPeersToUse ?? DEFAULT_NUM_PEERS_TO_USE;
    const maintainPeersInterval =
      options?.maintainPeersInterval ?? DEFAULT_MAINTAIN_PEERS_INTERVAL;

    this.startMaintainPeersInterval(maintainPeersInterval).catch((error) => {
      log.error("Error starting maintain peers interval:", error);
      throw error;
    });
  }

  /**
   * Disconnects from a peer and tries to find a new one to replace it.
   * @param peerToDisconnect The peer to disconnect from.
   */
  public async renewPeer(peerToDisconnect: PeerId): Promise<void> {
    log.info(`Renewing peer ${peerToDisconnect}`);
    try {
      await this.connectionManager.dropConnection(peerToDisconnect);
      this.peers = this.peers.filter((peer) => peer.id !== peerToDisconnect);
      log.info(
        `Peer ${peerToDisconnect} disconnected and removed from the peer list`
      );

      await this.findAndAddPeers();
    } catch (error) {
      log.error(`Error renewing peer ${peerToDisconnect}:`, error);
      log.info(
        "Peer renewal failed, relying on the interval to find a new peer"
      );
    }
  }

  /**
   * Stops the maintain peers interval.
   */
  public stopMaintainPeersInterval(): void {
    if (this.maintainPeersIntervalId) {
      log.info("Stopping maintain peers interval");
      clearInterval(this.maintainPeersIntervalId);
      this.maintainPeersIntervalId = undefined;
      log.info("Maintain peers interval stopped");
    }
  }

  /**
   * Starts an interval to maintain the peers list to `numPeersToUse`.
   * @param interval The interval in milliseconds to maintain the peers.
   */
  private async startMaintainPeersInterval(interval: number): Promise<void> {
    log.info("Starting maintain peers interval");
    try {
      await this.maintainPeers();
      this.maintainPeersIntervalId = setInterval(() => {
        this.maintainPeers().catch((error) => {
          log.error("Error during maintain peers interval:", error);
        });
      }, interval);
      log.info(`Maintain peers interval started with interval ${interval}ms`);
    } catch (error) {
      log.error("Error starting maintain peers interval:", error);
      throw error;
    }
  }

  /**
   * Maintains the peers list to `numPeersToUse`.
   */
  private async maintainPeers(): Promise<void> {
    log.info(`Maintaining peers, current count: ${this.peers.length}`);
    try {
      const numPeersToAdd = this.numPeersToUse - this.peers.length;
      if (numPeersToAdd > 0) {
        await this.findAndAddPeers(numPeersToAdd);
      }
      log.info(
        `Peer maintenance completed, current count: ${this.peers.length}`
      );
    } catch (error) {
      log.error("Error maintaining peers:", error);
      throw error;
    }
  }

  /**
   * Finds and adds new peers to the peers list.
   * @param numPeers The number of peers to find and add.
   */
  private async findAndAddPeers(numPeers: number = 1): Promise<void> {
    log.info(`Finding and adding ${numPeers} new peers`);
    try {
      const additionalPeers = await this.findAdditionalPeers(numPeers);
      this.peers = [...this.peers, ...additionalPeers];
      log.info(
        `Added ${additionalPeers.length} new peers, total peers: ${this.peers.length}`
      );
    } catch (error) {
      log.error("Error finding and adding new peers:", error);
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
    log.info(`Finding ${numPeers} additional peers`);
    try {
      let newPeers = await this.core.getPeers({
        maxBootstrapPeers: 0,
        numPeers: numPeers
      });

      if (newPeers.length === 0) {
        log.warn("No new peers found, trying with bootstrap peers");
        newPeers = await this.core.getPeers({
          maxBootstrapPeers: 1,
          numPeers: numPeers
        });
      }

      const additionalPeers = newPeers.filter(
        (peer) => this.peers.some((p) => p.id === peer.id) === false
      );
      log.info(`Found ${additionalPeers.length} additional peers`);
      return additionalPeers;
    } catch (error) {
      log.error("Error finding additional peers:", error);
      throw error;
    }
  }
}
