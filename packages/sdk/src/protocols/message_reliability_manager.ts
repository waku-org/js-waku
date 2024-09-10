import {
  IFilterSDK,
  IProtoMessage,
  PeerIdStr,
  PubsubTopic
} from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

const log = new Logger("sdk:message_reliability_monitor");

const DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD = 3;

export class MessageReliabilityMonitor {
  private receivedMessagesHashStr: string[] = [];
  private receivedMessagesHashes: {
    all: Set<string>;
    nodes: Record<string, Set<string>>;
  };
  private missedMessagesByPeer: Map<string, number> = new Map();
  private maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;

  public constructor(private filter: IFilterSDK) {
    this.receivedMessagesHashes = {
      all: new Set(),
      nodes: {}
    };
    this.initializeListeners();
  }

  private initializeListeners(): void {
    this.filter.setMessageHandler(this.handleFilterMessage.bind(this));
  }

  private handleFilterMessage(
    pubsubTopic: PubsubTopic,
    message: WakuMessage,
    peerIdStr?: string
  ): void {
    const isReliable = this.checkMessageReliability(
      pubsubTopic,
      message,
      peerIdStr
    );
    if (isReliable) {
      this.filter.processReliableMessage(pubsubTopic, message);
    }
  }

  private checkMessageReliability(
    pubsubTopic: PubsubTopic,
    message: WakuMessage,
    peerIdStr?: string
  ): boolean {
    const hashedMessageStr = messageHashStr(
      pubsubTopic,
      message as IProtoMessage
    );

    this.receivedMessagesHashes.all.add(hashedMessageStr);

    if (peerIdStr) {
      if (!this.receivedMessagesHashes.nodes[peerIdStr]) {
        this.receivedMessagesHashes.nodes[peerIdStr] = new Set();
      }
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
            await this.renewPeer(peerIdStr);
          }
        }
      }
    }
  }

  private async renewPeer(peerIdStr: PeerIdStr): Promise<void> {
    try {
      const peers = await this.filter.protocol.peerStore.all();
      const peerId = peers.find((p) => p.id.toString() === peerIdStr)?.id;
      if (!peerId) {
        log.error(`Peer ${peerIdStr} not found in peer store`);
        return;
      }
      await this.filter.renewPeer(peerId);
      this.missedMessagesByPeer.delete(peerIdStr);
      this.receivedMessagesHashes.nodes[peerIdStr] = new Set();
      log.info(`Successfully renewed peer ${peerIdStr}`);
    } catch (error) {
      log.error(`Failed to renew peer ${peerIdStr}`, error);
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

  public setMaxMissedMessagesThreshold(value: number): void {
    this.maxMissedMessagesThreshold = value;
  }
}
