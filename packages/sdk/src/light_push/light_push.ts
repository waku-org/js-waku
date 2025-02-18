import type { PeerId } from "@libp2p/interface";
import { ConnectionManager, LightPushCore } from "@waku/core";
import {
  type CoreProtocolResult,
  type IEncoder,
  ILightPush,
  type IMessage,
  type ISendOptions,
  type Libp2p,
  LightPushProtocolOptions,
  ProtocolError
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

import { RetryManager } from "./retry_manager.js";

const log = new Logger("sdk:light-push");

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_SEND_OPTIONS: LightPushProtocolOptions = {
  autoRetry: true,
  retryIntervalMs: 1000,
  maxAttempts: DEFAULT_MAX_ATTEMPTS
};

export class LightPush implements ILightPush {
  private readonly config: LightPushProtocolOptions;
  private readonly retryManager: RetryManager;

  public readonly protocol: LightPushCore;

  public constructor(
    connectionManager: ConnectionManager,
    private peerManager: PeerManager,
    libp2p: Libp2p,
    config: Partial<LightPushProtocolOptions> = {}
  ) {
    this.config = {
      ...DEFAULT_SEND_OPTIONS,
      ...config
    } as LightPushProtocolOptions;
    this.protocol = new LightPushCore(connectionManager.pubsubTopics, libp2p);

    this.retryManager = new RetryManager({
      peerManager,
      retryIntervalMs: this.config.retryIntervalMs
    });
  }

  public start(): void {
    this.peerManager.start();
  }

  public stop(): void {
    this.peerManager.stop();
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    options: ISendOptions = {}
  ): Promise<CoreProtocolResult> {
    options = {
      ...this.config,
      ...options
    };

    const { pubsubTopic } = encoder;

    log.info("send: attempting to send a message to pubsubTopic:", pubsubTopic);

    if (!this.protocol.pubsubTopics.includes(pubsubTopic)) {
      return {
        success: null,
        failure: {
          error: ProtocolError.TOPIC_NOT_CONFIGURED
        }
      };
    }

    const peerId = this.peerManager.getPeers()[0];

    if (!peerId) {
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_PEER_AVAILABLE
        }
      };
    }

    const result = await this.protocol.send(encoder, message, peerId);

    if (result.failure && options.autoRetry) {
      const sendCallback = (peerId: PeerId): Promise<CoreProtocolResult> =>
        this.protocol.send(encoder, message, peerId);
      this.retryManager.push(
        sendCallback.bind(this),
        options.maxAttempts || DEFAULT_MAX_ATTEMPTS
      );
    }

    return result;
  }
}

export function wakuLightPush(
  connectionManager: ConnectionManager,
  peerManager: PeerManager,
  config?: Partial<LightPushProtocolOptions>
): (libp2p: Libp2p) => ILightPush {
  return (libp2p: Libp2p): ILightPush =>
    new LightPush(connectionManager, peerManager, libp2p, config);
}
