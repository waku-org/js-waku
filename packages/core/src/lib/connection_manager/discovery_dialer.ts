import { Peer, PeerId, PeerInfo } from "@libp2p/interface";
import { Multiaddr } from "@multiformats/multiaddr";
import { Logger } from "@waku/utils";
import { Libp2p } from "libp2p";

import type { ShardReader } from "./shard_reader.js";

type Libp2pEventHandler<T> = (e: CustomEvent<T>) => void;

type DiscoveryDialerConstructorOptions = {
  libp2p: Libp2p;
  shardReader: ShardReader;
};

interface IDiscoveryDialer {
  start(): void;
  stop(): void;
}

const log = new Logger("discovery-dialer");

/**
 * This class is responsible for dialing peers that are discovered by the libp2p node.
 * Managing limits for the peers is out of scope for this class.
 * Dialing after discovery is needed to identify the peer and get all other information: metadata, protocols, etc.
 */
export class DiscoveryDialer implements IDiscoveryDialer {
  private readonly libp2p: Libp2p;
  private readonly shardReader: ShardReader;

  private dialingInterval: NodeJS.Timeout | null = null;
  private dialingQueue: PeerId[] = [];
  private dialHistory: Set<string> = new Set();

  public constructor(options: DiscoveryDialerConstructorOptions) {
    this.libp2p = options.libp2p;
    this.shardReader = options.shardReader;

    this.onPeerDiscovery = this.onPeerDiscovery.bind(this);
  }

  public start(): void {
    log.info("Starting discovery dialer");

    this.libp2p.addEventListener(
      "peer:discovery",
      this.onPeerDiscovery as Libp2pEventHandler<PeerInfo>
    );

    if (!this.dialingInterval) {
      this.dialingInterval = setInterval(() => {
        void this.processQueue();
      }, 500);

      log.info("Started dialing interval processor");
    }

    this.dialHistory.clear();
  }

  public stop(): void {
    log.info("Stopping discovery dialer");

    this.libp2p.removeEventListener(
      "peer:discovery",
      this.onPeerDiscovery as Libp2pEventHandler<PeerInfo>
    );

    if (this.dialingInterval) {
      clearInterval(this.dialingInterval);
      this.dialingInterval = null;

      log.info("Stopped dialing interval processor");
    }

    this.dialHistory.clear();
  }

  private async onPeerDiscovery(event: CustomEvent<PeerInfo>): Promise<void> {
    const peerId = event.detail.id;
    log.info(`Discovered new peer: ${peerId}`);

    try {
      const shouldSkip = await this.shouldSkipPeer(peerId);

      if (shouldSkip) {
        log.info(`Skipping peer: ${peerId}`);
        return;
      }

      await this.updatePeerStore(peerId, event.detail.multiaddrs);

      if (this.dialingQueue.length === 0) {
        await this.dialPeer(peerId);
      } else {
        this.dialingQueue.push(peerId);

        log.info(
          `Added peer to dialing queue, queue size: ${this.dialingQueue.length}`
        );
      }
    } catch (error) {
      log.error(`Error dialing peer ${peerId}`, error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.dialingQueue.length === 0) return;

    const peersToDial = this.dialingQueue.slice(0, 3);
    this.dialingQueue = this.dialingQueue.slice(peersToDial.length);

    log.info(
      `Processing dial queue: dialing ${peersToDial.length} peers, ${this.dialingQueue.length} remaining in queue`
    );

    await Promise.all(peersToDial.map(this.dialPeer));
  }

  private async shouldSkipPeer(peerId: PeerId): Promise<boolean> {
    if (this.dialHistory.has(peerId.toString())) {
      return true;
    }

    const hasShardInfo = await this.shardReader.hasShardInfo(peerId);
    if (!hasShardInfo) {
      return false;
    }

    const isOnSameShard = await this.shardReader.isPeerOnNetwork(peerId);
    if (!isOnSameShard) {
      log.info(`Skipping peer ${peerId} - not on same shard`);
      return true;
    }

    const hasConnection = this.libp2p.getPeers().some((p) => p.equals(peerId));
    if (hasConnection) {
      return true;
    }

    return false;
  }

  private async updatePeerStore(
    peerId: PeerId,
    multiaddrs: Multiaddr[]
  ): Promise<void> {
    try {
      const peer = await this.getPeer(peerId);

      if (!peer) {
        await this.libp2p.peerStore.save(peerId, {
          multiaddrs: multiaddrs
        });
        return;
      }

      const hasSameAddr = multiaddrs.every((addr) =>
        peer.addresses.some((a) => a.multiaddr.equals(addr))
      );

      if (hasSameAddr) {
        return;
      }

      await this.libp2p.peerStore.merge(peerId, {
        multiaddrs: multiaddrs
      });
    } catch (error) {
      log.error(`Error updating peer store for ${peerId}`, error);
    }
  }

  private async dialPeer(peerId: PeerId): Promise<void> {
    try {
      log.info(`Dialing peer from queue: ${peerId}`);

      await this.libp2p.dial(peerId);
      this.dialHistory.add(peerId.toString());

      log.info(`Successfully dialed peer from queue: ${peerId}`);
    } catch (error) {
      log.error(`Error dialing peer ${peerId}`, error);
    }
  }

  private async getPeer(peerId: PeerId): Promise<Peer | undefined> {
    try {
      return await this.libp2p.peerStore.get(peerId);
    } catch (error) {
      log.error(`Error getting peer info for ${peerId}`, error);
      return undefined;
    }
  }
}
