import type { PeerId } from "@libp2p/interface";
import { ConnectionManager, LightPushCore } from "@waku/core";
import {
  Failure,
  type IEncoder,
  ILightPushSDK,
  type IMessage,
  type Libp2p,
  type ProtocolCreateOptions,
  ProtocolError,
  SDKProtocolResult,
  SendOptions
} from "@waku/interfaces";
import { ensurePubsubTopicIsConfigured, Logger } from "@waku/utils";

import { BaseProtocolSDK } from "./base_protocol.js";

const log = new Logger("sdk:light-push");

class LightPushSDK extends BaseProtocolSDK implements ILightPushSDK {
  public readonly protocol: LightPushCore;

  constructor(
    connectionManager: ConnectionManager,
    libp2p: Libp2p,
    options?: ProtocolCreateOptions
  ) {
    super(new LightPushCore(libp2p, options), connectionManager, {
      numPeersToUse: options?.numPeersToUse
    });

    this.protocol = this.core as LightPushCore;
  }

  async send(
    encoder: IEncoder,
    message: IMessage,
    _options?: SendOptions
  ): Promise<SDKProtocolResult> {
    const options = {
      autoRetry: true,
      ..._options
    } as SendOptions;

    const successes: PeerId[] = [];
    const failures: Failure[] = [];

    const { pubsubTopic } = encoder;
    try {
      ensurePubsubTopicIsConfigured(pubsubTopic, this.protocol.pubsubTopics);
    } catch (error) {
      log.error("Failed to send waku light push: pubsub topic not configured");
      return {
        failures: [
          {
            error: ProtocolError.TOPIC_NOT_CONFIGURED
          }
        ],
        successes: []
      };
    }

    const hasPeers = await this.hasPeers(options);
    if (!hasPeers) {
      return {
        successes,
        failures: [
          {
            error: ProtocolError.NO_PEER_AVAILABLE
          }
        ]
      };
    }

    const sendPromises = this.connectedPeers.map((peer) =>
      this.protocol.send(encoder, message, peer)
    );

    const results = await Promise.allSettled(sendPromises);

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { failure, success } = result.value;
        if (success) {
          successes.push(success);
        }
        if (failure) {
          if (failure.peerId) {
            await this.renewPeer(failure.peerId);
          }

          failures.push(failure);
        }
      } else {
        log.error("Failed to send message to peer", result.reason);
        failures.push({ error: ProtocolError.GENERIC_FAIL });
      }
    }

    return {
      successes,
      failures
    };
  }
}

export function wakuLightPush(
  connectionManager: ConnectionManager,
  init: Partial<ProtocolCreateOptions> = {}
): (libp2p: Libp2p) => ILightPushSDK {
  return (libp2p: Libp2p) => new LightPushSDK(connectionManager, libp2p, init);
}
