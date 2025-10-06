import type { PeerId } from "@libp2p/interface";
import type {
  IEncoder,
  IMessage,
  IProtoMessage,
  LightPushCoreResult
} from "@waku/interfaces";
import { LightPushError, LightPushStatusCode } from "@waku/interfaces";
import { PushResponse, WakuMessage } from "@waku/proto";
import { isMessageSizeUnderCap, Logger } from "@waku/utils";
import { Uint8ArrayList } from "uint8arraylist";

import { CODECS } from "./constants.js";
import { PushRpcV2 } from "./push_rpc.js";
import { PushRpc } from "./push_rpc_v3.js";
import { isRLNResponseError } from "./utils.js";

type VersionedPushRpc =
  | ({ version: "v2" } & PushRpcV2)
  | ({ version: "v3" } & PushRpc);

type PreparePushMessageResult =
  | { rpc: VersionedPushRpc; error: null; message?: IProtoMessage }
  | { rpc: null; error: LightPushError; message?: IProtoMessage };

const log = new Logger("light-push:protocol-handler");

export class ProtocolHandler {
  public static async preparePushMessage(
    encoder: IEncoder,
    message: IMessage,
    protocol: string
  ): Promise<PreparePushMessageResult> {
    try {
      if (!message.payload || message.payload.length === 0) {
        log.error("Failed to send waku light push: payload is empty");
        return { rpc: null, error: LightPushError.EMPTY_PAYLOAD };
      }

      if (!(await isMessageSizeUnderCap(encoder, message))) {
        log.error("Failed to send waku light push: message is bigger than 1MB");
        return { rpc: null, error: LightPushError.SIZE_TOO_BIG };
      }

      const protoMessage = await encoder.toProtoObj(message);
      if (!protoMessage) {
        log.error("Failed to encode to protoMessage, aborting push");
        return { rpc: null, error: LightPushError.ENCODE_FAILED };
      }

      if (protocol === CODECS.v3) {
        log.info("Creating v3 RPC message");
        return {
          rpc: ProtocolHandler.createV3Rpc(protoMessage, encoder.pubsubTopic),
          error: null,
          message: protoMessage
        };
      }

      log.info("Creating v2 RPC message");
      return {
        rpc: ProtocolHandler.createV2Rpc(protoMessage, encoder.pubsubTopic),
        message: protoMessage,
        error: null
      };
    } catch (err) {
      log.error("Failed to prepare push message", err);
      return { rpc: null, error: LightPushError.GENERIC_FAIL };
    }
  }

  /**
   * Decode and evaluate a LightPush response according to the protocol version
   */
  public static handleResponse(
    bytes: Uint8ArrayList,
    protocol: string,
    peerId: PeerId
  ): LightPushCoreResult {
    if (protocol === CODECS.v3) {
      return ProtocolHandler.handleV3Response(bytes, peerId);
    }

    return ProtocolHandler.handleV2Response(bytes, peerId);
  }

  private static handleV3Response(
    bytes: Uint8ArrayList,
    peerId: PeerId
  ): LightPushCoreResult {
    try {
      const decodedRpcV3 = PushRpc.decodeResponse(bytes);
      const statusCode = decodedRpcV3.statusCode;
      const statusDesc = decodedRpcV3.statusDesc;

      if (statusCode !== LightPushStatusCode.SUCCESS) {
        const error = LightPushError.REMOTE_PEER_REJECTED;
        log.error(
          `Remote peer rejected with v3 status code ${statusCode}: ${statusDesc}`
        );
        return {
          success: null,
          failure: {
            error,
            peerId: peerId
          }
        };
      }

      if (decodedRpcV3.relayPeerCount !== undefined) {
        log.info(`Message relayed to ${decodedRpcV3.relayPeerCount} peers`);
      }

      return { success: peerId, failure: null };
    } catch (err) {
      return {
        success: null,
        failure: {
          error: LightPushError.DECODE_FAILED,
          peerId: peerId
        }
      };
    }
  }

  private static handleV2Response(
    bytes: Uint8ArrayList,
    peerId: PeerId
  ): LightPushCoreResult {
    let response: PushResponse | undefined;
    try {
      const decodedRpc = PushRpcV2.decode(bytes);
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

    if (isRLNResponseError(response.info)) {
      log.error("Remote peer fault: RLN generation");
      return {
        success: null,
        failure: {
          error: LightPushError.RLN_PROOF_GENERATION,
          peerId: peerId
        }
      };
    }

    if (!response.isSuccess) {
      log.error("Remote peer rejected the message: ", response.info);
      return {
        success: null,
        failure: {
          error: LightPushError.REMOTE_PEER_REJECTED,
          peerId: peerId
        }
      };
    }

    return { success: peerId, failure: null };
  }

  private static createV2Rpc(
    message: WakuMessage,
    pubsubTopic: string
  ): VersionedPushRpc {
    const v2Rpc = PushRpcV2.createRequest(message, pubsubTopic);
    return Object.assign(v2Rpc, { version: "v2" as const });
  }

  private static createV3Rpc(
    message: WakuMessage,
    pubsubTopic: string
  ): VersionedPushRpc {
    if (!message.timestamp) {
      message.timestamp = BigInt(Date.now()) * BigInt(1_000_000);
    }

    const v3Rpc = PushRpc.createRequest(message, pubsubTopic);
    return Object.assign(v3Rpc, { version: "v3" as const });
  }
}
