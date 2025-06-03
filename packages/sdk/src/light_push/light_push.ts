import type { PeerId } from "@libp2p/interface";
import {
  ConnectionManager,
  LightPushCodec,
  LightPushCore,
  LightPushCoreV3
} from "@waku/core";
import {
  type CoreProtocolResult,
  Failure,
  type IEncoder,
  ILightPush,
  type IMessage,
  type ISendOptions,
  type Libp2p,
  LightPushCodecV3,
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

  public readonly protocol: LightPushCoreV3;
  private readonly protocolV2: LightPushCore;
  private readonly protocolV3: LightPushCoreV3;
  private readonly libp2p: Libp2p;

  public constructor(params: LightPushConstructorParams) {
    this.config = {
      ...DEFAULT_SEND_OPTIONS,
      ...(params.options || {})
    } as LightPushProtocolOptions;

    this.peerManager = params.peerManager;
    this.libp2p = params.libp2p;

    this.protocolV2 = new LightPushCore(
      params.connectionManager.pubsubTopics,
      params.libp2p
    );
    this.protocolV3 = new LightPushCoreV3(
      params.connectionManager.pubsubTopics,
      params.libp2p
    );

    this.protocol = this.protocolV3;

    this.retryManager = new RetryManager({
      peerManager: params.peerManager,
      retryIntervalMs: this.config.retryIntervalMs
    });
  }

  public start(): void {
    this.retryManager.start();
  }

  public stop(): void {
    this.retryManager.stop();
  }

  private async selectProtocol(
    peerId: PeerId
  ): Promise<LightPushCore | LightPushCoreV3> {
    try {
      const peer = await this.libp2p.peerStore.get(peerId);

      if (peer.protocols.includes(LightPushCodecV3)) {
        log.info(`Using LightPush v3 for peer ${peerId.toString()}`);
        return this.protocolV3;
      }

      if (peer.protocols.includes(LightPushCodec)) {
        log.info(`Using LightPush v2 for peer ${peerId.toString()}`);
        return this.protocolV2;
      }

      log.warn(
        `No LightPush protocol advertised by peer ${peerId.toString()}, defaulting to v3`
      );
      return this.protocolV3;
    } catch (error) {
      log.warn(
        `Failed to get peer info for ${peerId.toString()}, defaulting to v3:`,
        error
      );
      return this.protocolV3;
    }
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

    if (
      !this.protocolV3.pubsubTopics.includes(pubsubTopic) &&
      !this.protocolV2.pubsubTopics.includes(pubsubTopic)
    ) {
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
      peerIds.map(async (peerId) => {
        try {
          const protocol = await this.selectProtocol(peerId);
          return await protocol.send(encoder, message, peerId);
        } catch (error) {
          log.error(
            `Failed to send message to peer ${peerId.toString()}:`,
            error
          );
          return {
            success: null,
            failure: {
              error: ProtocolError.GENERIC_FAIL
            }
          };
        }
      })
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
      const sendCallback = async (
        peerId: PeerId
      ): Promise<CoreProtocolResult> => {
        const protocol = await this.selectProtocol(peerId);
        return protocol.send(encoder, message, peerId);
      };
      this.retryManager.push(
        sendCallback.bind(this),
        options.maxAttempts || DEFAULT_MAX_ATTEMPTS
      );
    }

    return results;
  }
}
