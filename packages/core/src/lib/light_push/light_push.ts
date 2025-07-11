import type { PeerId, Stream } from "@libp2p/interface";
import {
  type CoreProtocolResult,
  type IEncoder,
  type IMessage,
  isSuccess as isV3Success,
  type Libp2p,
  ProtocolError,
  type ThisOrThat,
  toProtocolError
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

type PreparePushMessageResult = ThisOrThat<"query", PushRpc>;

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
        return { query: null, error: ProtocolError.EMPTY_PAYLOAD };
      }

      if (!(await isMessageSizeUnderCap(encoder, message))) {
        log.error("Failed to send waku light push: message is bigger than 1MB");
        return { query: null, error: ProtocolError.SIZE_TOO_BIG };
      }

      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log.error("Failed to encode to protoMessage, aborting push");
        return {
          query: null,
          error: ProtocolError.ENCODE_FAILED
        };
      }

      const query = PushRpc.createRequest(protoMessage, encoder.pubsubTopic);
      return { query, error: null };
    } catch (error) {
      log.error("Failed to prepare push message", error);

      return {
        query: null,
        error: ProtocolError.GENERIC_FAIL
      };
    }
  }

  public async send(
    encoder: IEncoder,
    message: IMessage,
    peerId: PeerId
  ): Promise<CoreProtocolResult> {
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

    let stream: Stream;
    let protocol: string;
    try {
      const result = await this.getProtocolStream(peerId);
      stream = result.stream;
      protocol = result.protocol;
      log.info(`Using protocol ${protocol} for peer ${peerId.toString()}`);
    } catch (error) {
      log.error("Failed to get stream", error);
      try {
        stream = await this.streamManager.getStream(peerId);
        protocol = LightPushCodec;
      } catch (fallbackError) {
        return {
          success: null,
          failure: {
            error: ProtocolError.NO_STREAM_AVAILABLE,
            peerId: peerId
          }
        };
      }
    }

    let res: Uint8ArrayList[] | undefined;
    try {
      res = await pipe(
        [query.encode()],
        lp.encode,
        stream,
        lp.decode,
        async (source) => await all(source)
      );
    } catch (err) {
      // can fail only because of `stream` abortion
      log.error("Failed to send waku light push request", err);
      return {
        success: null,
        failure: {
          error: ProtocolError.STREAM_ABORTED,
          peerId: peerId
        }
      };
    }

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => {
      bytes.append(chunk);
    });

    let response: PushResponse | undefined;
    try {
      response = PushRpc.decode(bytes).response;
    } catch (err) {
      log.error("Failed to decode push reply", err);
      return {
        success: null,
        failure: {
          error: ProtocolError.DECODE_FAILED,
          peerId: peerId
        }
      };
    }

    if (!response) {
      log.error("Remote peer fault: No response in PushRPC");
      return {
        success: null,
        failure: {
          error: ProtocolError.NO_RESPONSE,
          peerId: peerId
        }
      };
    }

    if (protocol === LightPushCodecV3 && response.statusCode !== undefined) {
      if (!isV3Success(response.statusCode)) {
        const error = toProtocolError(response.statusCode);
        log.error(
          `Remote peer rejected with v3 status code ${response.statusCode}: ${response.statusDesc || response.info}`
        );
        return {
          success: null,
          failure: {
            error,
            peerId: peerId
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
          error: ProtocolError.RLN_PROOF_GENERATION,
          peerId: peerId
        }
      };
    }

    if (!response.isSuccess) {
      log.error("Remote peer rejected the message: ", response.info);
      return {
        success: null,
        failure: {
          error: ProtocolError.REMOTE_PEER_REJECTED,
          peerId: peerId
        }
      };
    }

    return { success: peerId, failure: null };
  }
}
