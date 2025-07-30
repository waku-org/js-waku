import type { PeerId } from "@libp2p/interface";
import type { IEncoder, IMessage, LightPushCoreResult } from "@waku/interfaces";
import { LightPushError, LightPushStatusCode } from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { isMessageSizeUnderCap, Logger } from "@waku/utils";
import { Uint8ArrayList } from "uint8arraylist";

import { PushRpcV2 } from "./push_rpc.js";
import { PushRpc } from "./push_rpc_v3.js";
import { isRLNResponseError, isSuccess as isV3Success } from "./utils.js";

// Union type representing a LightPush RPC annotated with its protocol version
export type VersionedPushRpc =
  | ({ version: "v2" } & PushRpcV2)
  | ({ version: "v3" } & PushRpc);

export const CODECS = {
  v2: "/vac/waku/lightpush/2.0.0-beta1",
  v3: "/vac/waku/lightpush/3.0.0"
} as const;

export const LightPushCodec = CODECS.v3;

export { LightPushStatusCode };

const log = new Logger("light-push:protocol-handler");

export class ProtocolHandler {
  /**
   * Prepare a versioned LightPush RPC based on negotiated protocol
   */
  public static async processMessage(
    encoder: IEncoder,
    message: IMessage,
    protocol: string
  ): Promise<{ rpc: VersionedPushRpc | null; error: LightPushError | null }> {
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

      // Select version implementation
      if (protocol === CODECS.v3) {
        log.info("Creating v3 RPC message");
        return {
          rpc: createV3Rpc(protoMessage, encoder.pubsubTopic),
          error: null
        };
      }

      // Default to v2
      log.info("Creating v2 RPC message");
      return {
        rpc: createV2Rpc(protoMessage, encoder.pubsubTopic),
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

      if (!isV3Success(statusCode)) {
        const error = LightPushError.REMOTE_PEER_REJECTED;
        log.error(
          `Remote peer rejected with v3 status code ${statusCode}: ${statusDesc}`
        );
        return {
          success: null,
          failure: {
            error,
            peerId: peerId,
            statusCode,
            statusDesc,
            protocolVersion: "v3"
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
          peerId: peerId,
          protocolVersion: "v3"
        }
      };
    }
  }

  private static handleV2Response(
    bytes: Uint8ArrayList,
    peerId: PeerId
  ): LightPushCoreResult {
    let response: import("@waku/proto").PushResponse | undefined;
    try {
      const decodedRpc = PushRpcV2.decode(bytes);
      response = decodedRpc.response;
    } catch (err) {
      return {
        success: null,
        failure: {
          error: LightPushError.DECODE_FAILED,
          peerId: peerId,
          protocolVersion: "v2"
        }
      };
    }

    if (!response) {
      return {
        success: null,
        failure: {
          error: LightPushError.NO_RESPONSE,
          peerId: peerId,
          protocolVersion: "v2"
        }
      };
    }

    if (isRLNResponseError(response.info)) {
      log.error("Remote peer fault: RLN generation");
      return {
        success: null,
        failure: {
          error: LightPushError.RLN_PROOF_GENERATION,
          peerId: peerId,
          protocolVersion: "v2"
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
          protocolVersion: "v2"
        }
      };
    }

    return { success: peerId, failure: null };
  }
}

export function isV3(
  rpc: VersionedPushRpc
): rpc is { version: "v3" } & PushRpc {
  return rpc.version === "v3";
}

export function isV2(
  rpc: VersionedPushRpc
): rpc is { version: "v2" } & PushRpcV2 {
  return rpc.version === "v2";
}

export function createV2Rpc(
  message: WakuMessage,
  pubsubTopic: string
): VersionedPushRpc {
  const v2Rpc = PushRpcV2.createRequest(message, pubsubTopic);
  // Return the actual RPC object with version property to preserve methods
  return Object.assign(v2Rpc, { version: "v2" as const });
}

export function createV3Rpc(
  message: WakuMessage,
  pubsubTopic: string
): VersionedPushRpc {
  const v3Rpc = PushRpc.createRequest(message, pubsubTopic);
  // Return the actual RPC object with version property to preserve methods
  return Object.assign(v3Rpc, { version: "v3" as const });
}
