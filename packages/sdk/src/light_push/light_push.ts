import type { PeerId } from "@libp2p/interface";
import { ConnectionManager, LightPushCore } from "@waku/core";
import {
  type CoreProtocolResult,
  Failure,
  type IEncoder,
  ILightPush,
  type IMessage,
  type ISenderOptions,
  type Libp2p,
  ProtocolError,
  SDKProtocolResult
} from "@waku/interfaces";
import { ensurePubsubTopicIsConfigured, Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

const log = new Logger("sdk:light-push");

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_SEND_OPTIONS: ISenderOptions = {
  autoRetry: false,
  maxAttempts: DEFAULT_MAX_ATTEMPTS
};

type RetryCallback = (peerId: PeerId) => Promise<CoreProtocolResult>;

export class LightPush implements ILightPush {
  public readonly protocol: LightPushCore;

  public constructor(
    connectionManager: ConnectionManager,
    private peerManager: PeerManager,
    libp2p: Libp2p
  ) {
    this.protocol = new LightPushCore(connectionManager.pubsubTopics, libp2p);
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    options: ISenderOptions = DEFAULT_SEND_OPTIONS
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

    const peerIds = await this.peerManager.getPeers();
    if (peerIds.length === 0) {
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
      peerIds.map((id) => this.protocol.send(encoder, message, id))
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

        if (options?.autoRetry) {
          void this.attemptRetries(
            (id: PeerId) => this.protocol.send(encoder, message, id),
            options.maxAttempts
          );
        }
      }
    }

    return {
      successes,
      failures
    };
  }

  private async attemptRetries(
    fn: RetryCallback,
    maxAttempts?: number
  ): Promise<void> {
    maxAttempts = maxAttempts || DEFAULT_MAX_ATTEMPTS;
    const peerIds = await this.peerManager.getPeers();

    if (peerIds.length === 0) {
      log.warn("Cannot retry with no connected peers.");
      return;
    }

    for (let i = 0; i < maxAttempts; i++) {
      const id = peerIds[i % peerIds.length]; // always present as we checked for the length already
      const response = await fn(id);

      if (response.success) {
        return;
      }

      log.info(
        `Attempted retry for peer:${id} failed with:${response?.failure?.error}`
      );
    }
  }
}

export function wakuLightPush(
  connectionManager: ConnectionManager,
  peerManager: PeerManager
): (libp2p: Libp2p) => ILightPush {
  return (libp2p: Libp2p) =>
    new LightPush(connectionManager, peerManager, libp2p);
}
