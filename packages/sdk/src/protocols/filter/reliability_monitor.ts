import type { Peer, PeerId } from "@libp2p/interface";
import { PeerIdStr } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const DEFAULT_MAX_PINGS = 3;
const DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD = 3;

type ReceivedMessageHashes = {
  all: Set<string>;
  nodes: {
    [peerId: PeerIdStr]: Set<string>;
  };
};

const log = new Logger("sdk:filter:reliability-monitor");

export class ReliabilityMonitor {
  private receivedMessagesHashes: ReceivedMessageHashes;
  private peerFailures: Map<string, number> = new Map();
  private missedMessagesByPeer: Map<string, number> = new Map();
  private maxPingFailures: number = DEFAULT_MAX_PINGS;
  private maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;

  public constructor(
    private getPeers: () => Peer[],
    private readonly renewPeer: (peerToDisconnect: PeerId) => Promise<Peer>
  ) {
    const allPeerIdStr = this.getPeers().map((p) => p.id.toString());
    this.receivedMessagesHashes = {
      all: new Set(),
      nodes: {
        ...Object.fromEntries(allPeerIdStr.map((peerId) => [peerId, new Set()]))
      }
    };
    allPeerIdStr.forEach((peerId) => this.missedMessagesByPeer.set(peerId, 0));
  }

  public addHash(hash: string, peerIdStr?: string): void {
    this.receivedMessagesHashes.all.add(hash);

    if (peerIdStr) {
      this.receivedMessagesHashes.nodes[peerIdStr].add(hash);
    }
  }

  public async validateMessage(): Promise<void> {
    for (const hash of this.receivedMessagesHashes.all) {
      for (const [peerIdStr, hashes] of Object.entries(
        this.receivedMessagesHashes.nodes
      )) {
        if (!hashes.has(hash)) {
          this.incrementMissedMessageCount(peerIdStr);
          if (this.shouldRenewPeer(peerIdStr)) {
            log.info(
              `Peer ${peerIdStr} has missed too many messages, renewing.`
            );
            const peerId = this.getPeers().find(
              (p) => p.id.toString() === peerIdStr
            )?.id;
            if (!peerId) {
              log.error(
                `Unexpected Error: Peer ${peerIdStr} not found in connected peers.`
              );
              continue;
            }
            try {
              await this.renewAndSubscribePeer(peerId);
            } catch (error) {
              log.error(`Failed to renew peer ${peerIdStr}: ${error}`);
            }
          }
        }
      }
    }
  }

  public async handlePeerFailure(peerId: PeerId): Promise<void> {
    const failures = (this.peerFailures.get(peerId.toString()) || 0) + 1;
    this.peerFailures.set(peerId.toString(), failures);

    if (failures > this.maxPingFailures) {
      try {
        await this.renewAndSubscribePeer(peerId);
        this.peerFailures.delete(peerId.toString());
      } catch (error) {
        log.error(`Failed to renew peer ${peerId.toString()}: ${error}.`);
      }
    }
  }

  private async renewAndSubscribePeer(
    peerId: PeerId
  ): Promise<Peer | undefined> {
    try {
      const newPeer = await this.renewPeer(peerId);
      this.receivedMessagesHashes.nodes[newPeer.id.toString()] = new Set();
      this.missedMessagesByPeer.set(newPeer.id.toString(), 0);

      return newPeer;
    } catch (error) {
      log.warn(`Failed to renew peer ${peerId.toString()}: ${error}.`);
      return;
    } finally {
      this.peerFailures.delete(peerId.toString());
      this.missedMessagesByPeer.delete(peerId.toString());
      delete this.receivedMessagesHashes.nodes[peerId.toString()];
    }
  }

  private incrementMissedMessageCount(peerIdStr: string): void {
    const currentCount = this.missedMessagesByPeer.get(peerIdStr) || 0;
    this.missedMessagesByPeer.set(peerIdStr, currentCount + 1);
  }

  private shouldRenewPeer(peerIdStr: string): boolean {
    const missedMessages = this.missedMessagesByPeer.get(peerIdStr) || 0;
    return missedMessages > this.maxMissedMessagesThreshold;
  }
}
