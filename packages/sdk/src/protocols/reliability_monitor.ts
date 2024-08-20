import type { Peer, PeerId } from "@libp2p/interface";
import { IProtoMessage, PeerIdStr } from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";
import { type WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

const DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD = 3;

const log = new Logger("waku:message-monitor");

export class FilterReliabilityMonitor {
  private readonly receivedMessagesHashes: Set<string> = new Set();
  private readonly messageHashesByPeer: Map<PeerIdStr, Set<string>> = new Map();
  private readonly missedMessagesByPeer: Map<PeerIdStr, number> = new Map();
  private readonly maxMissedMessagesThreshold: number;

  public constructor(
    private readonly renewAndSubscribePeer: (
      peerToDisconnect: PeerId
    ) => Promise<Peer | undefined>
  ) {
    this.maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;
  }

  public async processAndValidateMessage(
    message: WakuMessage,
    pubsubTopic: string,
    peerIdStr: PeerIdStr,
    getPeers: () => Peer[]
  ): Promise<void> {
    const hash = messageHashStr(pubsubTopic, message as IProtoMessage);
    this.addMessage(hash, peerIdStr);
    await this.validateMessages(getPeers);
  }

  public resetPeer(peerIdStr: PeerIdStr): void {
    this.messageHashesByPeer.delete(peerIdStr);
    this.missedMessagesByPeer.delete(peerIdStr);
  }

  private addMessage(hash: string, peerIdStr: PeerIdStr): void {
    this.receivedMessagesHashes.add(hash);
    if (!this.messageHashesByPeer.has(peerIdStr)) {
      this.messageHashesByPeer.set(peerIdStr, new Set());
    }
    this.messageHashesByPeer.get(peerIdStr)!.add(hash);
  }

  private async validateMessages(getPeers: () => Peer[]): Promise<void> {
    const peersToRenew: PeerIdStr[] = [];
    for (const [peerIdStr, hashes] of this.messageHashesByPeer.entries()) {
      const missedMessages = [...this.receivedMessagesHashes].filter(
        (hash) => !hashes.has(hash)
      ).length;
      this.missedMessagesByPeer.set(peerIdStr, missedMessages);
      if (missedMessages > this.maxMissedMessagesThreshold) {
        peersToRenew.push(peerIdStr);
      }
    }

    for (const peerIdStr of peersToRenew) {
      const peerId = getPeers().find((p) => p.id.toString() === peerIdStr)?.id;
      if (peerId) {
        try {
          const newPeer = await this.renewAndSubscribePeer(peerId);
          if (newPeer) {
            this.resetPeer(peerIdStr);
            this.resetPeer(newPeer.id.toString());
          }
        } catch (error) {
          log.error(
            `Failed to renew and subscribe peer ${peerIdStr}: ${error}`
          );
        }
      }
    }
  }
}
