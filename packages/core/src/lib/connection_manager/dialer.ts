import type { PeerId } from "@libp2p/interface";
import { Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { ShardReader } from "./shard_reader.js";

const log = new Logger("dialer");

type DialerConstructorOptions = {
  libp2p: Libp2p;
  shardReader: ShardReader;
};

interface IDialer {
  start(): void;
  stop(): void;
  dial(peerId: PeerId): Promise<void>;
}

export class Dialer implements IDialer {
  private readonly libp2p: Libp2p;
  private readonly shardReader: ShardReader;

  private dialingQueue: PeerId[] = [];
  private dialHistory: Map<string, number> = new Map();
  private dialingInterval: NodeJS.Timeout | null = null;

  private isProcessing = false;
  private isImmediateDialing = false;

  public constructor(options: DialerConstructorOptions) {
    this.libp2p = options.libp2p;
    this.shardReader = options.shardReader;
  }

  public start(): void {
    log.info("Starting dialer");

    if (!this.dialingInterval) {
      this.dialingInterval = setInterval(() => {
        void this.processQueue();
      }, 500);
    }

    this.dialHistory.clear();
  }

  public stop(): void {
    log.info("Stopping dialer");

    if (this.dialingInterval) {
      clearInterval(this.dialingInterval);
      this.dialingInterval = null;
    }

    this.dialHistory.clear();
  }

  public async dial(peerId: PeerId): Promise<void> {
    const shouldSkip = await this.shouldSkipPeer(peerId);

    if (shouldSkip) {
      log.info(`Skipping peer: ${peerId}`);
      return;
    }

    const isEmptyQueue = this.dialingQueue.length === 0;
    const isNotDialing = !this.isProcessing && !this.isImmediateDialing;

    // If queue is empty and we're not currently processing, dial immediately
    if (isEmptyQueue && isNotDialing) {
      this.isImmediateDialing = true;
      log.info("Dialed peer immediately");
      await this.dialPeer(peerId);
      this.isImmediateDialing = false;
      log.info("Released immediate dial lock");
    } else {
      this.dialingQueue.push(peerId);
      log.info(
        `Added peer to dialing queue, queue size: ${this.dialingQueue.length}`
      );
    }
  }

  private async processQueue(): Promise<void> {
    if (this.dialingQueue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const peersToDial = this.dialingQueue.slice(0, 3);
      this.dialingQueue = this.dialingQueue.slice(peersToDial.length);

      log.info(
        `Processing dial queue: dialing ${peersToDial.length} peers, ${this.dialingQueue.length} remaining in queue`
      );

      await Promise.all(peersToDial.map((peerId) => this.dialPeer(peerId)));
    } finally {
      this.isProcessing = false;
    }
  }

  private async dialPeer(peerId: PeerId): Promise<void> {
    try {
      log.info(`Dialing peer from queue: ${peerId}`);

      await this.libp2p.dial(peerId);
      this.dialHistory.set(peerId.toString(), Date.now());

      log.info(`Successfully dialed peer from queue: ${peerId}`);
    } catch (error) {
      log.error(`Error dialing peer ${peerId}`, error);
    }
  }

  private async shouldSkipPeer(peerId: PeerId): Promise<boolean> {
    const hasConnection = this.libp2p.getPeers().some((p) => p.equals(peerId));
    if (hasConnection) {
      log.info(`Skipping peer ${peerId} - already connected`);
      return true;
    }

    const lastDialed = this.dialHistory.get(peerId.toString());
    if (lastDialed && Date.now() - lastDialed < 10_000) {
      log.info(
        `Skipping peer ${peerId} - already dialed in the last 10 seconds`
      );
      return true;
    }

    try {
      const hasShardInfo = await this.shardReader.hasShardInfo(peerId);
      if (!hasShardInfo) {
        log.info(`Skipping peer ${peerId} - no shard info`);
        return false;
      }

      const isOnSameShard = await this.shardReader.isPeerOnNetwork(peerId);
      if (!isOnSameShard) {
        log.info(`Skipping peer ${peerId} - not on same shard`);
        return true;
      }

      return false;
    } catch (error) {
      log.error(`Error checking shard info for peer ${peerId}`, error);
      return true; // Skip peer when there's an error
    }
  }
}
