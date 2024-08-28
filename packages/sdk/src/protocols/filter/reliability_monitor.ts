import type { Peer, PeerId } from "@libp2p/interface";
import { IProtoMessage, PeerIdStr, PubsubTopic } from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

type ReceivedMessageHashes = {
  all: Set<string>;
  nodes: {
    [peerId: PeerIdStr]: Set<string>;
  };
};

const DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD = 3;

const log = new Logger("sdk:filter:reliability_monitor");

export class ReliabilityMonitor {
  public receivedMessagesHashStr: string[] = [];
  public receivedMessagesHashes: ReceivedMessageHashes;
  public missedMessagesByPeer: Map<string, number> = new Map();
  public maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;

  public constructor(
    private getPeers: () => Peer[],
    private renewAndSubscribePeer: (peerId: PeerId) => Promise<Peer | undefined>
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

  public setMaxMissedMessagesThreshold(value: number | undefined): void {
    if (value === undefined) {
      return;
    }
    this.maxMissedMessagesThreshold = value;
  }

  public get messageHashes(): string[] {
    return [...this.receivedMessagesHashes.all];
  }

  public addMessage(
    message: WakuMessage,
    pubsubTopic: PubsubTopic,
    peerIdStr?: string
  ): boolean {
    const hashedMessageStr = messageHashStr(
      pubsubTopic,
      message as IProtoMessage
    );

    this.receivedMessagesHashes.all.add(hashedMessageStr);

    if (peerIdStr) {
      this.receivedMessagesHashes.nodes[peerIdStr].add(hashedMessageStr);
    }

    if (this.receivedMessagesHashStr.includes(hashedMessageStr)) {
      return true;
    } else {
      this.receivedMessagesHashStr.push(hashedMessageStr);
      return false;
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

  private incrementMissedMessageCount(peerIdStr: string): void {
    const currentCount = this.missedMessagesByPeer.get(peerIdStr) || 0;
    this.missedMessagesByPeer.set(peerIdStr, currentCount + 1);
  }

  private shouldRenewPeer(peerIdStr: string): boolean {
    const missedMessages = this.missedMessagesByPeer.get(peerIdStr) || 0;
    return missedMessages > this.maxMissedMessagesThreshold;
  }
}
