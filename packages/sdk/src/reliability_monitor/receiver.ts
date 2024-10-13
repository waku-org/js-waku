import type { Peer, PeerId } from "@libp2p/interface";
import {
  ContentTopic,
  CoreProtocolResult,
  IProtoMessage,
  Libp2p,
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

export class ReceiverReliabilityMonitor {
  private receivedMessagesHashes: ReceivedMessageHashes;
  private missedMessagesByPeer: Map<string, number> = new Map();
  private maxMissedMessagesThreshold = DEFAULT_MAX_MISSED_MESSAGES_THRESHOLD;
  private peerFailures: Map<string, number> = new Map();
  private maxPingFailures: number = DEFAULT_MAX_PINGS;
  private peerRenewalLocks: Set<PeerIdStr> = new Set();

  public constructor(
    private readonly pubsubTopic: PubsubTopic,
    private getPeers: () => Peer[],
    private renewPeer: (peerId: PeerId) => Promise<Peer | undefined>,
    private getContentTopics: () => ContentTopic[],
    private protocolSubscribe: (
      pubsubTopic: PubsubTopic,
      peer: Peer,
      contentTopics: ContentTopic[]
    ) => Promise<CoreProtocolResult>,
    private addLibp2pEventListener: Libp2p["addEventListener"]
  ) {
    const allPeerIdStr = this.getPeers().map((p) => p.id.toString());

    this.receivedMessagesHashes = {
      all: new Set(),
      nodes: {
        ...Object.fromEntries(allPeerIdStr.map((peerId) => [peerId, new Set()]))
      }
    };
    allPeerIdStr.forEach((peerId) => this.missedMessagesByPeer.set(peerId, 0));

    this.addLibp2pEventListener("peer:disconnect", (evt) => {
      const peerId = evt.detail;
      if (this.getPeers().some((p) => p.id.equals(peerId))) {
        void this.renewAndSubscribePeer(peerId);
      }
    });
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

    if (failures >= this.maxPingFailures) {
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

    const alreadyReceived =
      this.receivedMessagesHashes.all.has(hashedMessageStr);
    this.receivedMessagesHashes.all.add(hashedMessageStr);

    if (peerIdStr) {
      const hashesForPeer = this.receivedMessagesHashes.nodes[peerIdStr];
      if (!hashesForPeer) {
        log.warn(
          `Peer ${peerIdStr} not initialized in receivedMessagesHashes.nodes, adding it.`
        );
        this.receivedMessagesHashes.nodes[peerIdStr] = new Set();
      }
      this.receivedMessagesHashes.nodes[peerIdStr].add(hashedMessageStr);
    }

    return alreadyReceived;
  }

  // @ts-expect-error Turned off until properly investigated and dogfooded: https://github.com/waku-org/js-waku/issues/2075
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
    const peerIdStr = peerId.toString();
    try {
      if (this.peerRenewalLocks.has(peerIdStr)) {
        log.info(`Peer ${peerIdStr} is already being renewed.`);
        return;
      }

      this.peerRenewalLocks.add(peerIdStr);

      const newPeer = await this.renewPeer(peerId);
      if (!newPeer) {
        log.warn(`Failed to renew peer ${peerIdStr}: No new peer found.`);
        return;
      }

      await this.protocolSubscribe(
        this.pubsubTopic,
        newPeer,
        this.getContentTopics()
      );

      this.receivedMessagesHashes.nodes[newPeer.id.toString()] = new Set();
      this.missedMessagesByPeer.set(newPeer.id.toString(), 0);

      this.peerFailures.delete(peerIdStr);
      this.missedMessagesByPeer.delete(peerIdStr);
      delete this.receivedMessagesHashes.nodes[peerIdStr];

      return newPeer;
    } catch (error) {
      log.error(`Failed to renew peer ${peerIdStr}: ${error}.`);
      return;
    } finally {
      this.peerRenewalLocks.delete(peerIdStr);
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
