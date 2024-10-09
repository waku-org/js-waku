import { Peer, PeerId } from "@libp2p/interface";
import { utf8ToBytes } from "@noble/hashes/utils";
import { ConnectionManager, getHealthManager } from "@waku/core";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import { IHealthManager } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { bytesToUtf8 } from "@waku/utils/bytes";
import { Mutex } from "async-mutex";

const METADATA_KEY = "usedByProtocol";

export class PeerManager {
  private healthManager: IHealthManager;

  private readMutex = new Mutex();
  private writeMutex = new Mutex();
  private writeLockHolder: string | null = null;

  public constructor(
    private readonly connectionManager: ConnectionManager,
    private readonly core: BaseProtocol,
    private readonly log: Logger
  ) {
    this.healthManager = getHealthManager();
    this.healthManager.updateProtocolHealth(this.core.multicodec, 0);
  }

  public getWriteLockHolder(): string | null {
    return this.writeLockHolder;
  }

  public async getPeers(): Promise<Peer[]> {
    const allPeers = await this.connectionManager.libp2p.peerStore.all();
    return allPeers.filter((peer) => this.isPeerUsedByProtocol(peer));
  }

  public async addPeer(peer: Peer): Promise<void> {
    return this.writeMutex.runExclusive(async () => {
      this.writeLockHolder = `addPeer: ${peer.id.toString()}`;
      await this.connectionManager.attemptDial(peer.id);
      await this._addPeer(peer);
      this.log.info(`Added and dialed peer: ${peer.id.toString()}`);
      const peerCount = await this.getPeerCount();
      this.healthManager.updateProtocolHealth(this.core.multicodec, peerCount);
      this.writeLockHolder = null;
    });
  }

  public async removePeer(peerId: PeerId): Promise<void> {
    return this.writeMutex.runExclusive(async () => {
      this.writeLockHolder = `removePeer: ${peerId.toString()}`;
      const peer = await this.connectionManager.libp2p.peerStore.get(peerId);
      if (peer) {
        await this._removePeer(peer);
        this.log.info(`Removed peer: ${peerId.toString()}`);
        const peerCount = await this.getPeerCount();
        this.healthManager.updateProtocolHealth(
          this.core.multicodec,
          peerCount
        );
      }
      this.writeLockHolder = null;
    });
  }

  public async getPeerCount(): Promise<number> {
    return this.readMutex.runExclusive(async () => {
      const peers = await this.getPeers();
      return peers.length;
    });
  }

  public async hasPeers(): Promise<boolean> {
    return this.readMutex.runExclusive(async () => {
      const peerCount = await this.getPeerCount();
      return peerCount > 0;
    });
  }

  public async removeExcessPeers(excessPeers: number): Promise<void> {
    this.log.info(`Removing ${excessPeers} excess peer(s)`);
    const peers = await this.getPeers();
    const peersToRemove = peers.slice(0, excessPeers);
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
      this.log.warn("No additional peers found");
      return [];
    }
    return this.addMultiplePeers(additionalPeers);
  }

  /**
   * Finds additional peers.
   * @param numPeers The number of peers to find.
   */
  public async findPeers(numPeers: number): Promise<Peer[]> {
    const connectedPeers = await this.core.getPeers();

    return this.readMutex.runExclusive(async () => {
      const currentPeers = await this.getPeers();
      const newPeers = connectedPeers
        .filter((peer) => !currentPeers.some((p) => p.id.equals(peer.id)))
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

  private async _addPeer(peer: Peer): Promise<void> {
    const connectedPeers = this.connectionManager.libp2p.getPeers();
    if (connectedPeers.some((p) => p.equals(peer.id))) {
      return;
    }
    const _peer = await this.connectionManager.libp2p.peerStore.get(peer.id);
    if (!_peer) {
      return;
    }
    this.updatePeerMetadataWithUsageStatus(peer, true);
  }

  private async _removePeer(peer: Peer): Promise<void> {
    this.updatePeerMetadataWithUsageStatus(peer, false);
  }

  private updatePeerMetadataWithUsageStatus(
    peer: Peer,
    isCurrentlyUsed: boolean
  ): void {
    if (isCurrentlyUsed) {
      peer.metadata.set(
        METADATA_KEY,
        utf8ToBytes(this.core.multicodec.toString())
      );
    } else {
      peer.metadata.delete(METADATA_KEY);
    }
  }

  private isPeerUsedByProtocol(peer: Peer): boolean {
    const usedByProtocol = peer.metadata.get(METADATA_KEY);
    if (!usedByProtocol) return false;

    const protocolString = bytesToUtf8(usedByProtocol);
    return protocolString === this.core.multicodec.toString();
  }
}
