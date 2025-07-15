import type { PeerId } from "@libp2p/interface";
import { ConnectionManager, LightPushCore } from "@waku/core";
import {
  type IEncoder,
  ILightPush,
  type IMessage,
  type ISendOptions,
  type Libp2p,
  type LightPushCoreResult,
  LightPushError,
  type LightPushFailure,
  LightPushProtocolOptions,
  type LightPushSDKResult,
  Protocols
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import { PeerManager } from "../peer_manager/index.js";

import { RetryManager } from "./retry_manager.js";

const log = new Logger("sdk:light-push");

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_SEND_OPTIONS: LightPushProtocolOptions = {
  autoRetry: true,
  retryIntervalMs: 1000,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  numPeersToUse: 1
};

type LightPushConstructorParams = {
  connectionManager: ConnectionManager;
  peerManager: PeerManager;
  libp2p: Libp2p;
  options?: Partial<LightPushProtocolOptions>;
};

export class LightPush implements ILightPush {
  private readonly config: LightPushProtocolOptions;
  private readonly retryManager: RetryManager;
  private readonly peerManager: PeerManager;
  private readonly connectionManager: ConnectionManager;
  private readonly protocol: LightPushCore;

  public constructor(params: LightPushConstructorParams) {
    this.config = {
      ...DEFAULT_SEND_OPTIONS,
      ...(params.options || {})
    } as LightPushProtocolOptions;

    this.peerManager = params.peerManager;
    this.connectionManager = params.connectionManager;
    this.protocol = new LightPushCore(params.libp2p);
    this.retryManager = new RetryManager({
      peerManager: params.peerManager,
      retryIntervalMs: this.config.retryIntervalMs
    });
  }

  public get multicodec(): string {
    return this.protocol.multicodec;
  }

  public start(): void {
    this.retryManager.start();
  }

  public stop(): void {
    this.retryManager.stop();
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    options: ISendOptions = {}
  ): Promise<LightPushSDKResult> {
    options = {
      ...this.config,
      ...options
    };

    const { pubsubTopic } = encoder;

    log.info("send: attempting to send a message to pubsubTopic:", pubsubTopic);

    if (!this.connectionManager.isTopicConfigured(pubsubTopic)) {
      return {
        successes: [],
        failures: [
          {
            error: LightPushError.TOPIC_NOT_CONFIGURED
          }
        ]
      };
    }

    const peerIds = await this.peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: encoder.pubsubTopic
    });

    const coreResults: LightPushCoreResult[] =
      peerIds?.length > 0
        ? await Promise.all(
            peerIds.map((peerId) =>
              this.protocol.send(encoder, message, peerId).catch((_e) => ({
                success: null,
                failure: {
                  error: LightPushError.GENERIC_FAIL
                }
              }))
            )
          )
        : [];

    const results: LightPushSDKResult = coreResults.length
      ? {
          successes: coreResults
            .filter((v) => v.success)
            .map((v) => v.success) as PeerId[],
          failures: coreResults
            .filter((v) => v.failure)
            .map((v) => v.failure) as LightPushFailure[]
        }
      : {
          successes: [],
          failures: [
            {
              error: LightPushError.NO_PEER_AVAILABLE
            }
          ]
        };

    if (options.autoRetry && results.successes.length === 0) {
      const sendCallback = (peerId: PeerId): Promise<LightPushCoreResult> =>
        this.protocol.send(encoder, message, peerId);
      this.retryManager.push(
        sendCallback.bind(this),
        options.maxAttempts || DEFAULT_MAX_ATTEMPTS,
        encoder.pubsubTopic
      );
    }

    return results;
  }
}
