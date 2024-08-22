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

const log = new Logger("reliability-monitor");

export class ReliabilityMonitor {
  private readonly receivedMessagesHashStr: string[] = [];
  private readonly receivedMessagesHashes: ReceivedMessageHashes;
  private missedMessagesByPeer: Map<string, number> = new Map();
  private maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;

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

  public async processMessage(
    pubsubTopic: PubsubTopic,
    message: WakuMessage,
    peerIdStr: PeerIdStr
  ): Promise<boolean> {
    const hashedMessageStr = messageHashStr(
      pubsubTopic,
      message as IProtoMessage
    );

    if (this.isMessageAlreadyReceived(hashedMessageStr)) {
      log.info("Message already received, skipping");
      return true;
    }

    this.addMessageHash(hashedMessageStr, peerIdStr);
    await this.checkMissedMessages();

    return false;
  }

  private isMessageAlreadyReceived(hashedMessageStr: string): boolean {
    return this.receivedMessagesHashStr.includes(hashedMessageStr);
  }

  private addMessageHash(hash: string, peerIdStr?: string): void {
    this.receivedMessagesHashStr.push(hash);
    this.receivedMessagesHashes.all.add(hash);

    if (peerIdStr) {
      this.receivedMessagesHashes.nodes[peerIdStr].add(hash);
    }
  }

  private async checkMissedMessages(): Promise<void> {
    for (const hash of this.receivedMessagesHashes.all) {
      for (const [peerIdStr, hashes] of Object.entries(
        this.receivedMessagesHashes.nodes
      )) {
        if (!hashes.has(hash)) {
          await this.handleMissedMessage(peerIdStr);
        }
      }
    }
  }

  private async handleMissedMessage(peerIdStr: string): Promise<void> {
    this.incrementMissedMessageCount(peerIdStr);
    if (this.shouldRenewPeer(peerIdStr)) {
      await this.renewPeer(peerIdStr);
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

  private async renewPeer(peerIdStr: string): Promise<void> {
    log.info(`Peer ${peerIdStr} has missed too many messages, renewing.`);
    const peerId = this.getPeers().find(
      (p) => p.id.toString() === peerIdStr
    )?.id;
    if (!peerId) {
      log.error(
        `Unexpected Error: Peer ${peerIdStr} not found in connected peers.`
      );
      return;
    }
    try {
      await this.renewAndSubscribePeer(peerId);
    } catch (error) {
      log.error(`Failed to renew peer ${peerIdStr}: ${error}`);
    }
  }

  public resetPeerStats(peerIdStr: string): void {
    this.missedMessagesByPeer.set(peerIdStr, 0);
    this.receivedMessagesHashes.nodes[peerIdStr] = new Set();
  }

  public removePeerStats(peerIdStr: string): void {
    this.missedMessagesByPeer.delete(peerIdStr);
    delete this.receivedMessagesHashes.nodes[peerIdStr];
  }
}
