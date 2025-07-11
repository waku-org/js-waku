import { ProtocolError } from "./protocols.js";
import type { ISender, ISendOptions } from "./sender.js";

export type LightPushProtocolOptions = ISendOptions & {
  /**
   * The interval in milliseconds to wait before retrying a failed push.
   * @default 1000
   */
  retryIntervalMs: number;

  /**
   * Number of peers to send message to.
   *
   * @default 1
   */
  numPeersToUse?: number;
};

export type ILightPush = ISender & {
  readonly multicodec: string;
  start: () => void;
  stop: () => void;
};

export enum LightPushStatusCode {
  SUCCESS = 200,
  BAD_REQUEST = 400,
  PAYLOAD_TOO_LARGE = 413,
  INVALID_MESSAGE = 420,
  UNSUPPORTED_TOPIC = 421,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_ERROR = 500,
  UNAVAILABLE = 503,
  NO_RLN_PROOF = 504,
  NO_PEERS = 505
}

export const StatusDescriptions: Record<LightPushStatusCode, string> = {
  [LightPushStatusCode.SUCCESS]: "Message sent successfully",
  [LightPushStatusCode.BAD_REQUEST]: "Bad request format",
  [LightPushStatusCode.PAYLOAD_TOO_LARGE]:
    "Message payload exceeds maximum size",
  [LightPushStatusCode.INVALID_MESSAGE]: "Message validation failed",
  [LightPushStatusCode.UNSUPPORTED_TOPIC]: "Unsupported pubsub topic",
  [LightPushStatusCode.TOO_MANY_REQUESTS]: "Rate limit exceeded",
  [LightPushStatusCode.INTERNAL_ERROR]: "Internal server error",
  [LightPushStatusCode.UNAVAILABLE]: "Service temporarily unavailable",
  [LightPushStatusCode.NO_RLN_PROOF]: "RLN proof generation failed",
  [LightPushStatusCode.NO_PEERS]: "No relay peers available"
};

export function isSuccess(statusCode: number | undefined): boolean {
  return statusCode === LightPushStatusCode.SUCCESS;
}

export function toProtocolError(
  statusCode: LightPushStatusCode | number | undefined
): ProtocolError {
  if (!statusCode) {
    return ProtocolError.GENERIC_FAIL;
  }

  switch (statusCode) {
    case LightPushStatusCode.SUCCESS:
      return ProtocolError.GENERIC_FAIL;
    case LightPushStatusCode.BAD_REQUEST:
    case LightPushStatusCode.INVALID_MESSAGE:
    case LightPushStatusCode.TOO_MANY_REQUESTS:
      return ProtocolError.REMOTE_PEER_REJECTED;
    case LightPushStatusCode.PAYLOAD_TOO_LARGE:
      return ProtocolError.SIZE_TOO_BIG;
    case LightPushStatusCode.UNSUPPORTED_TOPIC:
      return ProtocolError.TOPIC_NOT_CONFIGURED;
    case LightPushStatusCode.UNAVAILABLE:
    case LightPushStatusCode.NO_PEERS:
      return ProtocolError.NO_PEER_AVAILABLE;
    case LightPushStatusCode.NO_RLN_PROOF:
      return ProtocolError.RLN_PROOF_GENERATION;
    case LightPushStatusCode.INTERNAL_ERROR:
    default:
      return ProtocolError.GENERIC_FAIL;
  }
}

export function getStatusDescription(
  statusCode: number | undefined,
  customDesc?: string
): string {
  if (customDesc) {
    return customDesc;
  }

  if (!statusCode) {
    return "Unknown error";
  }

  return (
    StatusDescriptions[statusCode as LightPushStatusCode] ||
    `Unknown status code: ${statusCode}`
  );
}
