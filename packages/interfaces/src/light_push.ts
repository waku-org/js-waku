import { LightPushError } from "./protocols.js";
import type { ILightPushSender, ISendOptions } from "./sender.js";

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

export type ILightPush = ILightPushSender & {
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

export function toLightPushError(
  statusCode: LightPushStatusCode | number | undefined
): LightPushError {
  if (!statusCode) {
    return LightPushError.GENERIC_FAIL;
  }

  switch (statusCode) {
    case LightPushStatusCode.SUCCESS:
      return LightPushError.GENERIC_FAIL;
    case LightPushStatusCode.BAD_REQUEST:
      return LightPushError.BAD_REQUEST;
    case LightPushStatusCode.INVALID_MESSAGE:
      return LightPushError.INVALID_MESSAGE;
    case LightPushStatusCode.TOO_MANY_REQUESTS:
      return LightPushError.TOO_MANY_REQUESTS;
    case LightPushStatusCode.PAYLOAD_TOO_LARGE:
      return LightPushError.PAYLOAD_TOO_LARGE;
    case LightPushStatusCode.UNSUPPORTED_TOPIC:
      return LightPushError.UNSUPPORTED_TOPIC;
    case LightPushStatusCode.UNAVAILABLE:
      return LightPushError.UNAVAILABLE;
    case LightPushStatusCode.NO_PEERS:
      return LightPushError.NO_PEERS;
    case LightPushStatusCode.NO_RLN_PROOF:
      return LightPushError.NO_RLN_PROOF;
    case LightPushStatusCode.INTERNAL_ERROR:
    default:
      return LightPushError.INTERNAL_ERROR;
  }
}

// Legacy function for backward compatibility
/**
 * @deprecated Use toLightPushError instead
 */
export function toProtocolError(
  statusCode: LightPushStatusCode | number | undefined
): LightPushError {
  return toLightPushError(statusCode);
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

/**
 * Maps a protocol codec string to a version identifier
 * @param codec - The protocol codec string (e.g., "/vac/waku/lightpush/3.0.0")
 * @returns Version string (e.g., "v3", "v2") or "unknown" if not recognized
 */
export function getProtocolVersion(codec: string): string {
  if (codec.includes("3.0.0")) {
    return "v3";
  }
  if (codec.includes("2.0.0")) {
    return "v2";
  }
  return "unknown";
}

/**
 * Determines protocol version from status code presence
 * v3 protocols include statusCode, v2 protocols do not
 * @param hasStatusCode - Whether the response includes a status code
 * @returns Version string ("v3" or "v2")
 */
export function inferProtocolVersion(hasStatusCode: boolean): string {
  return hasStatusCode ? "v3" : "v2";
}
