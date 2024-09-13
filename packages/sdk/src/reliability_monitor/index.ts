import type { Peer, PeerId } from "@libp2p/interface";
import {
  ContentTopic,
  CoreProtocolResult,
  PubsubTopic
} from "@waku/interfaces";

import { ReceiverReliabilityMonitor } from "./receiver.js";

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

  public static destroy(pubsubTopic: PubsubTopic): void {
    this.receiverMonitors.delete(pubsubTopic);
  }

  public static destroyAll(): void {
    for (const [pubsubTopic, monitor] of this.receiverMonitors) {
      monitor.setMaxMissedMessagesThreshold(undefined);
      monitor.setMaxPingFailures(undefined);
      this.receiverMonitors.delete(pubsubTopic);
    }
  }
}
