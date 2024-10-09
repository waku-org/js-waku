import type { Peer, PeerId } from "@libp2p/interface";
import {
  ConnectionManager,
  getHealthManager,
  LightPushCodec,
  LightPushCore
} from "@waku/core";
import {
  Failure,
  type IEncoder,
  ILightPush,
  type IMessage,
  type Libp2p,
  type ProtocolCreateOptions,
  ProtocolError,
  ProtocolUseOptions,
  SDKProtocolResult
} from "@waku/interfaces";
import { ensurePubsubTopicIsConfigured, Logger } from "@waku/utils";

import { ReliabilityMonitorManager } from "../../reliability_monitor/index.js";
import { SenderReliabilityMonitor } from "../../reliability_monitor/sender.js";
import { BaseProtocolSDK } from "../base_protocol.js";

const log = new Logger("sdk:light-push");

class LightPush extends BaseProtocolSDK implements ILightPush {
  public readonly protocol: LightPushCore;

  private readonly reliabilityMonitor: SenderReliabilityMonitor;

  public constructor(
    connectionManager: ConnectionManager,
    private libp2p: Libp2p,
    options?: ProtocolCreateOptions
  ) {
    super(
      new LightPushCore(connectionManager.configuredPubsubTopics, libp2p),
      connectionManager,
      {
        numPeersToUse: options?.numPeersToUse
      }
    );

    this.reliabilityMonitor = ReliabilityMonitorManager.createSenderMonitor(
      this.renewPeer.bind(this)
    );

    this.protocol = this.core as LightPushCore;
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    _options?: ProtocolUseOptions
  ): Promise<SDKProtocolResult> {
    const successes: PeerId[] = [];
    const failures: Failure[] = [];

    const { pubsubTopic } = encoder;
    try {
      ensurePubsubTopicIsConfigured(pubsubTopic, this.protocol.pubsubTopics);
    } catch (error) {
      log.error("Failed to send waku light push: pubsub topic not configured");
      return {
        successes,
        failures: [
          {
            error: ProtocolError.TOPIC_NOT_CONFIGURED
          }
        ]
      };
    }

    const peers = await this.getConnectedPeers();
    if (peers.length === 0) {
      return {
        successes,
        failures: [
          {
            error: ProtocolError.NO_PEER_AVAILABLE
          }
        ]
      };
    }

    const results = await Promise.allSettled(
      peers.map((peer) => this.protocol.send(encoder, message, peer))
    );

    for (const result of results) {
      if (result.status !== "fulfilled") {
        log.error("Failed unexpectedly while sending:", result.reason);
        failures.push({ error: ProtocolError.GENERIC_FAIL });
        continue;
      }

      const { failure, success } = result.value;

      if (success) {
        successes.push(success);
        continue;
      }

      if (failure) {
        failures.push(failure);

        const connectedPeer = this.connectedPeers.find((connectedPeer) =>
          connectedPeer.id.equals(failure.peerId)
        );

        if (connectedPeer) {
          void this.reliabilityMonitor.attemptRetriesOrRenew(
            connectedPeer.id,
            () => this.protocol.send(encoder, message, connectedPeer)
          );
        }
      }
    }

    getHealthManager().updateProtocolHealth(
      this.protocol.multicodec,
      successes.length
    );

    return {
      successes,
      failures
    };
  }

  private async getConnectedPeers(): Promise<Peer[]> {
    const peerIDs = this.libp2p.getPeers();

    if (peerIDs.length === 0) {
      return [];
    }

    const peers = await Promise.all(
      peerIDs.map(async (id) => {
        try {
          return await this.libp2p.peerStore.get(id);
        } catch (e) {
          return null;
        }
      })
    );

    return peers
      .filter((p) => !!p)
      .filter((p) => (p as Peer).protocols.includes(LightPushCodec))
      .slice(0, this.numPeersToUse) as Peer[];
  }
}

export function wakuLightPush(
  connectionManager: ConnectionManager,
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => ILightPush {
  return (libp2p: Libp2p) => new LightPush(connectionManager, libp2p, init);
}
