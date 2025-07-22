import type { PeerId } from "@libp2p/interface";
import {
  type IEncoder,
  type IMessage,
  inferProtocolVersion,
  isSuccess as isV3Success,
  type Libp2p,
  type LightPushCoreResult,
  LightPushError,
  type ThisOrThat,
  toLightPushError
} from "@waku/interfaces";
import { PushResponse } from "@waku/proto";
import { isMessageSizeUnderCap } from "@waku/utils";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { StreamManager } from "../stream_manager/index.js";
import { selectOpenConnection } from "../stream_manager/utils.js";

import { PushRpc } from "./push_rpc.js";
import { isRLNResponseError } from "./utils.js";

const log = new Logger("light-push");

export const LightPushCodec = "/vac/waku/lightpush/2.0.0-beta1";
export const LightPushCodecV3 = "/vac/waku/lightpush/3.0.0";
export const LightPushCodecs = [LightPushCodecV3, LightPushCodec];
export { PushResponse };

type PreparePushMessageResult = ThisOrThat<
  "query",
  PushRpc,
  "error",
  LightPushError
>;

/**
 * Implements the [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
 */
export class LightPushCore {
  private readonly streamManager: StreamManager;

  public readonly multicodec = LightPushCodec;
  public readonly multicodecs = LightPushCodecs;

  public constructor(private libp2p: Libp2p) {
    this.streamManager = new StreamManager(LightPushCodec, libp2p.components);
  }

  private async getProtocolStream(
    peerId: PeerId
  ): Promise<{ stream: Stream; protocol: string }> {
    const peer = await this.libp2p.peerStore.get(peerId);
    const protocols = peer.protocols;

    const supportsV3 = protocols.includes(LightPushCodecV3);
    const supportsV2 = protocols.includes(LightPushCodec);

    if (!supportsV2 && !supportsV3) {
      throw new Error("Peer does not support any Light Push protocol");
    }

    // TODO: Remove forced v2 fallback - currently disabled to test v3 protocol communication
    // Prefer v3 protocol when available, fallback to v2
    const protocol = supportsV3 ? LightPushCodecV3 : LightPushCodec;

    let stream: Stream;
    try {
      const connections = this.libp2p.getConnections(peerId);
      const connection = selectOpenConnection(connections);

      if (!connection) {
        throw new Error("No open connection to peer");
      }

      stream = await connection.newStream(protocol);
    } catch (error) {
      if (supportsV3 && supportsV2) {
        // TODO: This fallback should be evaluated for v3 compatibility
        log.warn("Failed to create v3 stream, falling back to v2", error);
        stream = await this.streamManager.getStream(peerId);
        return { stream, protocol: LightPushCodec };
      }
      throw error;
    }

    return { stream, protocol };
  }

  private async preparePushMessage(
    encoder: IEncoder,
    message: IMessage
  ): Promise<PreparePushMessageResult> {
    try {
      if (!message.payload || message.payload.length === 0) {
        log.error("Failed to send waku light push: payload is empty");
        return { query: null, error: LightPushError.EMPTY_PAYLOAD };
      }

      if (!(await isMessageSizeUnderCap(encoder, message))) {
        log.error("Failed to send waku light push: message is bigger than 1MB");
        return { query: null, error: LightPushError.SIZE_TOO_BIG };
      }

      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log.error("Failed to encode to protoMessage, aborting push");
        return {
          query: null,
          error: LightPushError.ENCODE_FAILED
        };
      }

      const query = PushRpc.createRequest(protoMessage, encoder.pubsubTopic);
      return { query, error: null };
    } catch (error) {
      log.error("Failed to prepare push message", error);

      return {
        query: null,
        error: LightPushError.GENERIC_FAIL
      };
    }
  }

  private isTopicConfigured(_topic: string): boolean {
    // Placeholder for actual configuration check logic
    // Return true if the topic is configured, false otherwise
    return true;
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    peerId: PeerId
  ): Promise<LightPushCoreResult> {
    if (!this.isTopicConfigured(encoder.pubsubTopic)) {
      log.error(
        `Pubsub topic ${encoder.pubsubTopic} is not configured, aborting send`
      );
      return {
        success: null,
        failure: {
          error: LightPushError.TOPIC_NOT_CONFIGURED,
          peerId
        }
      };
    }
    const { query, error: preparationError } = await this.preparePushMessage(
      encoder,
      message
    );

    if (preparationError || !query) {
      return {
        success: null,
        failure: {
          error: preparationError,
          peerId
        }
      };
    }

    const stream = await this.streamManager.getStream(peerId);

    if (!stream) {
      log.error(`Failed to get a stream for remote peer:${peerId.toString()}`);
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_STREAM_AVAILABLE,
          peerId: peerId
        }
      };
    }

    let res: Uint8ArrayList[] | undefined;
    try {
      const encodedQuery = query.encode();

      res = await pipe(
        [encodedQuery],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );
    } catch (err) {
      // can fail only because of `stream` abortion
      return {
        success: null,
        failure: {
          error: LightPushError.STREAM_ABORTED,
          peerId: peerId
        }
      };
    }

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => {
      bytes.append(chunk);
    });

    if (bytes.length === 0) {
      return {
        success: null,
        failure: {
          error: LightPushError.NO_RESPONSE,
          peerId: peerId
        }
      };
    }

    let response: PushResponse | undefined;
    try {
      const decodedRpc = PushRpc.decode(bytes);
      response = decodedRpc.response;
    } catch (err) {
      return {
        success: null,
        failure: {
          error: LightPushError.DECODE_FAILED,
          peerId: peerId
        }
      };
    }

    if (!response) {
      return {
        success: null,
        failure: {
          error: LightPushError.NO_RESPONSE,
          peerId: peerId
        }
      };
    }

    // Determine protocol version for response handling
    const protocolVersion = inferProtocolVersion(
      response.statusCode !== undefined
    );

    if (protocol === LightPushCodecV3 && response.statusCode !== undefined) {
      if (!isV3Success(response.statusCode)) {
        const error = toLightPushError(response.statusCode);
        log.error(
          `Remote peer rejected with v3 status code ${response.statusCode}: ${response.statusDesc || response.info}`
        );
        return {
          success: null,
          failure: {
            error,
            peerId: peerId,
            statusCode: response.statusCode,
            statusDesc: response.statusDesc || response.info,
            protocolVersion
          }
        };
      }

      if (response.relayPeerCount !== undefined) {
        log.info(`Message relayed to ${response.relayPeerCount} peers`);
      }

      return { success: peerId, failure: null };
    }

    if (isRLNResponseError(response.info)) {
      log.error("Remote peer fault: RLN generation");
      return {
        success: null,
        failure: {
          error: LightPushError.RLN_PROOF_GENERATION,
          peerId: peerId,
          protocolVersion
        }
      };
    }

    if (!response.isSuccess) {
      log.error("Remote peer rejected the message: ", response.info);
      return {
        success: null,
        failure: {
          error: LightPushError.REMOTE_PEER_REJECTED,
          peerId: peerId,
          statusDesc: response.info,
          protocolVersion
        }
      };
    }

    return { success: peerId, failure: null };
  }
}
