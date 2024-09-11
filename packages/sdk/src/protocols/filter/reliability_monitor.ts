import type { Peer, PeerId } from "@libp2p/interface";
import {
  ContentTopic,
  CoreProtocolResult,
  IProtoMessage,
  PeerIdStr,
  PubsubTopic
} from "@waku/interfaces";
import { messageHashStr } from "@waku/message-hash";
import { WakuMessage } from "@waku/proto";
import { Logger } from "@waku/utils";

type ReceivedMessageHashes = {
  all: Set<string>;
  nodes: Record<PeerIdStr, Set<string>>;
};

const DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD = 3;

const log = new Logger("sdk:receiver:reliability_monitor");

const DEFAULT_MAX_PINGS = 3;

export class ReliabilityMonitorManager {
  private static receiverMonitors: Map<
    PubsubTopic,
    ReceiverReliabilityMonitor
  > = new Map();

  public static createReceiverMonitor(
    pubsubTopic: PubsubTopic,
    getPeers: () => Peer[],
    renewPeer: (peerId: PeerId) => Promise<Peer>,
    getContentTopics: () => ContentTopic[],
    protocolSubscribe: (
      pubsubTopic: PubsubTopic,
      peer: Peer,
      contentTopics: ContentTopic[]
    ) => Promise<CoreProtocolResult>
  ): ReceiverReliabilityMonitor {
    if (ReliabilityMonitorManager.receiverMonitors.has(pubsubTopic)) {
      return ReliabilityMonitorManager.receiverMonitors.get(pubsubTopic)!;
    }

    const monitor = new ReceiverReliabilityMonitor(
      pubsubTopic,
      getPeers,
      renewPeer,
      getContentTopics,
      protocolSubscribe
    );
    ReliabilityMonitorManager.receiverMonitors.set(pubsubTopic, monitor);
    return monitor;
  }

  private constructor() {}
}

export class ReceiverReliabilityMonitor {
  private receivedMessagesHashStr: string[] = [];
  private receivedMessagesHashes: ReceivedMessageHashes;
  private missedMessagesByPeer: Map<string, number> = new Map();
  private maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;
  private peerFailures: Map<string, number> = new Map();
  private maxPingFailures: number = DEFAULT_MAX_PINGS;

  public constructor(
    private readonly pubsubTopic: PubsubTopic,
    private getPeers: () => Peer[],
    private renewPeer: (peerId: PeerId) => Promise<Peer>,
    private getContentTopics: () => ContentTopic[],
    private protocolSubscribe: (
      pubsubTopic: PubsubTopic,
      peer: Peer,
      contentTopics: ContentTopic[]
    ) => Promise<CoreProtocolResult>
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

  public setMaxPingFailures(value: number | undefined): void {
    if (value === undefined) {
      return;
    }
    this.maxPingFailures = value;
  }

  public async handlePingResult(
    peerId: PeerId,
    result?: CoreProtocolResult
  ): Promise<void> {
    if (result?.success) {
      this.peerFailures.delete(peerId.toString());
      return;
    }

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

  public processIncomingMessage(
    message: WakuMessage,
    pubsubTopic: PubsubTopic,
    peerIdStr?: string
  ): boolean {
    const alreadyReceived = this.addMessageToCache(
      message,
      pubsubTopic,
      peerIdStr
    );
    void this.checkAndRenewPeers();
    return alreadyReceived;
  }

  private addMessageToCache(
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
      const x = this.receivedMessagesHashes.nodes[peerIdStr];
      if (!x) {
        log.warn(
          `Peer ${peerIdStr} not initialized in receivedMessagesHashes.nodes, adding it.`
        );
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

  private async checkAndRenewPeers(): Promise<void> {
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

  private async renewAndSubscribePeer(
    peerId: PeerId
  ): Promise<Peer | undefined> {
    try {
      const newPeer = await this.renewPeer(peerId);
      await this.protocolSubscribe(
        this.pubsubTopic,
        newPeer,
        this.getContentTopics()
      );

      this.receivedMessagesHashes.nodes[newPeer.id.toString()] = new Set();
      this.missedMessagesByPeer.set(newPeer.id.toString(), 0);

      this.peerFailures.delete(peerId.toString());
      this.missedMessagesByPeer.delete(peerId.toString());
      delete this.receivedMessagesHashes.nodes[peerId.toString()];

      return newPeer;
    } catch (error) {
      log.warn(`Failed to renew peer ${peerId.toString()}: ${error}.`);
      return;
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
