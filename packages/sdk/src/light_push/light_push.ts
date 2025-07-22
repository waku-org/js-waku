import type { PeerId } from "@libp2p/interface";
import { LightPushCore } from "@waku/core";
import { inferProtocolVersion } from "@waku/core";
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
  peerManager: PeerManager;
  libp2p: Libp2p;
  options?: Partial<LightPushProtocolOptions>;
};

export class LightPush implements ILightPush {
  private readonly config: LightPushProtocolOptions;
  private readonly retryManager: RetryManager;
  private readonly peerManager: PeerManager;
  private readonly protocol: LightPushCore;

  public constructor(params: LightPushConstructorParams) {
    this.config = {
      ...DEFAULT_SEND_OPTIONS,
      ...(params.options || {})
    } as LightPushProtocolOptions;

    this.peerManager = params.peerManager;
    this.protocol = new LightPushCore(params.libp2p);
    this.retryManager = new RetryManager({
      peerManager: params.peerManager,
      retryIntervalMs: this.config.retryIntervalMs
    });
  }

  public get multicodec(): string {
    return this.protocol.multicodec;
  }

  /**
   * Get all supported protocol codecs
   * @returns Array of supported protocol codec strings
   */
  public get multicodecs(): string[] {
    return this.protocol.multicodecs;
  }

  /**
   * Get supported protocol versions
   * @returns Array of supported version strings (e.g., ['v2', 'v3'])
   */
  public get supportedVersions(): string[] {
    return this.protocol.multicodecs.map((codec) => {
      if (codec.includes("3.0.0")) return "v3";
      if (codec.includes("2.0.0")) return "v2";
      return "unknown";
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
  ): Promise<LightPushSDKResult> {
    options = {
      ...this.config,
      ...options
    };

    const { pubsubTopic } = encoder;

    log.info("send: attempting to send a message to pubsubTopic:", pubsubTopic);

    const peerIds = await this.peerManager.getPeers({
      protocol: Protocols.LightPush,
      pubsubTopic: encoder.pubsubTopic
    });

    // Track protocol versions used per peer
    const protocolVersions: Record<string, string> = {};

    const coreResults: LightPushCoreResult[] =
      peerIds?.length > 0
        ? await Promise.all(
            peerIds.map(async (peerId) => {
              try {
                const result = await this.protocol.send(
                  encoder,
                  message,
                  peerId
                );

                // Enhanced error logging with protocol version information
                if (result.failure) {
                  const peerIdStr = peerId.toString();
                  const protocolVersion =
                    result.failure.protocolVersion ||
                    inferProtocolVersion(
                      result.failure.statusCode !== undefined
                    );
                  protocolVersions[peerIdStr] = protocolVersion;

                  log.warn(
                    `Failed to send to peer ${peerIdStr} (${protocolVersion}): ${result.failure.error}`,
                    {
                      peerId: peerIdStr,
                      protocolVersion,
                      error: result.failure.error,
                      statusCode: result.failure.statusCode,
                      statusDesc: result.failure.statusDesc
                    }
                  );

                  // Ensure protocolVersion is set in failure
                  if (!result.failure.protocolVersion) {
                    result.failure.protocolVersion = protocolVersion;
                  }
                } else if (result.success) {
                  // For successful sends, we need to infer protocol version from peer capabilities
                  // This is a best-effort approach since success responses don't always contain version info
                  const peerIdStr = peerId.toString();
                  protocolVersions[peerIdStr] = "v3"; // Assume v3 for successful sends (will be corrected if needed)

                  log.info(`Successfully sent to peer ${peerIdStr}`);
                }

                return result;
              } catch (error) {
                const peerIdStr = peerId.toString();
                protocolVersions[peerIdStr] = "unknown";

                log.error(`Exception sending to peer ${peerIdStr}:`, error);

                return {
                  success: null,
                  failure: {
                    error: LightPushError.GENERIC_FAIL,
                    peerId,
                    protocolVersion: "unknown"
                  }
                };
              }
            })
          )
        : [];

    const results: LightPushSDKResult = coreResults.length
      ? {
          successes: coreResults
            .filter((v) => v.success)
            .map((v) => v.success) as PeerId[],
          failures: coreResults
            .filter((v) => v.failure)
            .map((v) => v.failure) as LightPushFailure[],
          protocolVersions
        }
      : {
          successes: [],
          failures: [
            {
              error: LightPushError.NO_PEER_AVAILABLE
            }
          ],
          protocolVersions: {}
        };

    if (options.autoRetry && results.successes.length === 0) {
      const sendCallback = (peerId: PeerId): Promise<LightPushCoreResult> =>
        this.protocol.send(encoder, message, peerId);
      this.retryManager.push(
        sendCallback.bind(this),
        options.maxAttempts || DEFAULT_MAX_ATTEMPTS,
        encoder.routingInfo
      );
    }

    return results;
  }
}
