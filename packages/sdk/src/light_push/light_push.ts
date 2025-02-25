import type { PeerId } from "@libp2p/interface";
import { ConnectionManager, LightPushCore } from "@waku/core";
import {
  type CoreProtocolResult,
  Failure,
  type IEncoder,
  ILightPush,
  type IMessage,
  type ISendOptions,
  type Libp2p,
  LightPushProtocolOptions,
  ProtocolError,
  SDKProtocolResult
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

type RetryCallback = (peerId: PeerId) => Promise<CoreProtocolResult>;

type LightPushConstructorParams = {
  connectionManager: ConnectionManager;
  peerManager: PeerManager;
  libp2p: Libp2p;
  options?: Partial<LightPushProtocolOptions>;
};

export class LightPush implements ILightPush {
  private readonly config: LightPushProtocolOptions;
  private readonly retryManager: RetryManager;
  private peerManager: PeerManager;

  public readonly protocol: LightPushCore;

  public constructor(params: LightPushConstructorParams) {
    this.config = {
      ...DEFAULT_SEND_OPTIONS,
      ...(params.options || {})
    } as LightPushProtocolOptions;

    this.peerManager = params.peerManager;
    this.protocol = new LightPushCore(
      params.connectionManager.pubsubTopics,
      params.libp2p
    );
    this.retryManager = new RetryManager({
      params.peerManager,
      retryIntervalMs: this.config.retryIntervalMs
    });
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
  ): Promise<SDKProtocolResult> {
    options = {
      ...this.config,
      ...options
    };

    const { pubsubTopic } = encoder;

    log.info("send: attempting to send a message to pubsubTopic:", pubsubTopic);

    if (!this.protocol.pubsubTopics.includes(pubsubTopic)) {
      return {
        successes: [],
        failures: [
          {
            error: ProtocolError.TOPIC_NOT_CONFIGURED
          }
        ]
      };
    }

    const peerIds = this.peerManager
      .getPeers()
      .slice(0, this.config.numPeersToUse);

    if (peerIds.length === 0) {
      return {
        successes: [],
        failures: [
          {
            error: ProtocolError.NO_PEER_AVAILABLE
          }
        ]
      };
    }

    const coreResults: CoreProtocolResult[] = await Promise.all(
      peerIds.map((peerId) =>
        this.protocol.send(encoder, message, peerId).catch((_e) => ({
          success: null,
          failure: {
            error: ProtocolError.GENERIC_FAIL
          }
        }))
      )
    );

    const results: SDKProtocolResult = {
      successes: coreResults
        .filter((v) => v.success)
        .map((v) => v.success) as PeerId[],
      failures: coreResults
        .filter((v) => v.failure)
        .map((v) => v.failure) as Failure[]
    };

    if (options.autoRetry && results.successes.length === 0) {
      const sendCallback = (peerId: PeerId): Promise<CoreProtocolResult> =>
        this.protocol.send(encoder, message, peerId);
      this.retryManager.push(
        sendCallback.bind(this),
        options.maxAttempts || DEFAULT_MAX_ATTEMPTS
      );
    }

    return results;
  }
}
