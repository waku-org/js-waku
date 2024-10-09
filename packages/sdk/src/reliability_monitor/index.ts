import type { Peer, PeerId } from "@libp2p/interface";
import {
  ContentTopic,
  CoreProtocolResult,
  Libp2p,
  PubsubTopic
} from "@waku/interfaces";

import { ReceiverReliabilityMonitor } from "./receiver.js";
import { SenderReliabilityMonitor } from "./sender.js";

export class ReliabilityMonitorManager {
  private static receiverMonitors: Map<
    PubsubTopic,
    ReceiverReliabilityMonitor
  > = new Map();
  private static senderMonitor: SenderReliabilityMonitor | undefined;

  public static createReceiverMonitor(
    pubsubTopic: PubsubTopic,
    getPeers: () => Peer[],
    renewPeer: (peerId: PeerId) => Promise<Peer | undefined>,
    getContentTopics: () => ContentTopic[],
    protocolSubscribe: (
      pubsubTopic: PubsubTopic,
      peer: Peer,
      contentTopics: ContentTopic[]
    ) => Promise<CoreProtocolResult>,
    addLibp2pEventListener: Libp2p["addEventListener"]
  ): ReceiverReliabilityMonitor {
    if (ReliabilityMonitorManager.receiverMonitors.has(pubsubTopic)) {
      return ReliabilityMonitorManager.receiverMonitors.get(pubsubTopic)!;
    }

    const monitor = new ReceiverReliabilityMonitor(
      pubsubTopic,
      getPeers,
      renewPeer,
      getContentTopics,
      protocolSubscribe,
      addLibp2pEventListener
    );
    ReliabilityMonitorManager.receiverMonitors.set(pubsubTopic, monitor);
    return monitor;
  }

  public static createSenderMonitor(
    renewPeer: (peerId: PeerId) => Promise<Peer | undefined>
  ): SenderReliabilityMonitor {
    if (!ReliabilityMonitorManager.senderMonitor) {
      ReliabilityMonitorManager.senderMonitor = new SenderReliabilityMonitor(
        renewPeer
      );
    }
    return ReliabilityMonitorManager.senderMonitor;
  }

  private constructor() {}

  public static stop(pubsubTopic: PubsubTopic): void {
    this.receiverMonitors.delete(pubsubTopic);
    this.senderMonitor = undefined;
  }

  public static stopAll(): void {
    for (const [pubsubTopic, monitor] of this.receiverMonitors) {
      monitor.setMaxMissedMessagesThreshold(undefined);
      monitor.setMaxPingFailures(undefined);
      this.receiverMonitors.delete(pubsubTopic);
      this.senderMonitor = undefined;
    }
  }
}
