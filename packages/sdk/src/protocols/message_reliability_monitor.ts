import {
  IFilterSDK,
  IProtoMessage,
  ISubscriptionSDK,
  PeerIdStr,
  PubsubTopic
} from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

const log = new Logger("sdk:message_reliability_monitor");

const DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD = 3;

export class MessageReliabilityTracker {
  public static receiverMonitor: Map<PubsubTopic, ReceiverReliabilityMonitor> =
    new Map();

  public constructor() {}
}

export class ReceiverReliabilityMonitor {
  private receivedMessagesHashStr: string[] = [];
  private receivedMessagesHashes: {
    all: Set<string>;
    nodes: Record<string, Set<string>>;
  };
  private missedMessagesByPeer: Map<string, number> = new Map();
  private maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;

  public constructor(
    private filter: IFilterSDK,
    private subscription: ISubscriptionSDK
  ) {
    MessageReliabilityTracker.receiverMonitor.set(
      this.subscription.pubsubTopic,
      this
    );

    this.receivedMessagesHashes = {
      all: new Set(),
      nodes: {}
    };

    this.filter.setIncomingMessageHandler(this.handleFilterMessage.bind(this));
  }

  public destructor(): void {
    MessageReliabilityTracker.receiverMonitor.delete(
      this.subscription.pubsubTopic
    );
  }

  private handleFilterMessage(
    pubsubTopic: PubsubTopic,
    message: WakuMessage,
    peerIdStr: string
  ): void {
    const isReceived = this.isMessageAlreadyReceived(
      pubsubTopic,
      message,
      peerIdStr
    );
    if (isReceived) {
      return;
    }

    void this.validatePreviousMessage();

    this.filter.defaultHandleIncomingMessage(pubsubTopic, message, peerIdStr);
  }

  private isMessageAlreadyReceived(
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

  private async validatePreviousMessage(): Promise<void> {
    if (this.receivedMessagesHashStr.length < 2) {
      return; // Not enough messages to validate
    }

    const previousMessageHash =
      this.receivedMessagesHashStr[this.receivedMessagesHashStr.length - 2];

    for (const [peerIdStr, hashes] of Object.entries(
      this.receivedMessagesHashes.nodes
    )) {
      if (!hashes.has(previousMessageHash)) {
        this.incrementMissedMessageCount(peerIdStr);
        if (this.shouldRenewPeer(peerIdStr)) {
          log.info(`Peer ${peerIdStr} has missed too many messages, renewing.`);
          await this.renewPeer(peerIdStr);
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

      await this.subscription.renewAndSubscribePeer(peerId);

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
