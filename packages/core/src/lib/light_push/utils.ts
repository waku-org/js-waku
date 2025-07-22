import {
  LightPushError,
  LightPushStatusCode,
  StatusDescriptions
} from "@waku/interfaces";

// should match nwaku
// https://github.com/waku-org/nwaku/blob/c3cb06ac6c03f0f382d3941ea53b330f6a8dd127/waku/waku_rln_relay/rln_relay.nim#L309
// https://github.com/waku-org/nwaku/blob/c3cb06ac6c03f0f382d3941ea53b330f6a8dd127/tests/waku_rln_relay/rln/waku_rln_relay_utils.nim#L20
const RLN_GENERATION_PREFIX_ERROR = "could not generate rln proof";
const RLN_MESSAGE_ID_PREFIX_ERROR =
  "could not get new message id to generate an rln proof";

// rare case on nwaku side
// https://github.com/waku-org/nwaku/blob/a4e92a3d02448fd708857b7b6cac2a7faa7eb4f9/waku/waku_lightpush/callbacks.nim#L49
// https://github.com/waku-org/nwaku/blob/a4e92a3d02448fd708857b7b6cac2a7faa7eb4f9/waku/node/waku_node.nim#L1117
const RLN_REMOTE_VALIDATION = "RLN validation failed";

export const isRLNResponseError = (info?: string): boolean => {
  if (!info) {
    return false;
  }

  return (
    info.includes(RLN_GENERATION_PREFIX_ERROR) ||
    info.includes(RLN_MESSAGE_ID_PREFIX_ERROR) ||
    info.includes(RLN_REMOTE_VALIDATION)
  );
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
