import { ProtocolError } from "@waku/interfaces";

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

/**
 * Maps error information from push response to appropriate ProtocolError
 * Uses pattern matching to handle various error cases
 */
export function mapInfoToProtocolError(info?: string): ProtocolError {
  if (!info) {
    return ProtocolError.REMOTE_PEER_REJECTED;
  }

  const lowerInfo = info.toLowerCase();

  // RLN errors
  if (isRLNResponseError(info)) {
    return ProtocolError.RLN_PROOF_GENERATION;
  }

  // Rate limiting patterns
  if (
    lowerInfo.includes("rate limit") ||
    lowerInfo.includes("too many requests")
  ) {
    return ProtocolError.REMOTE_PEER_REJECTED;
  }

  // Topic errors
  if (
    lowerInfo.includes("topic") &&
    (lowerInfo.includes("not found") || lowerInfo.includes("not configured"))
  ) {
    return ProtocolError.TOPIC_NOT_CONFIGURED;
  }

  // Size errors
  if (lowerInfo.includes("too large") || lowerInfo.includes("size")) {
    return ProtocolError.SIZE_TOO_BIG;
  }

  // Decoding errors
  if (
    lowerInfo.includes("decode") ||
    lowerInfo.includes("invalid") ||
    lowerInfo.includes("malformed")
  ) {
    return ProtocolError.DECODE_FAILED;
  }

  // Empty payload
  if (lowerInfo.includes("empty") && lowerInfo.includes("payload")) {
    return ProtocolError.EMPTY_PAYLOAD;
  }

  // Default case
  return ProtocolError.REMOTE_PEER_REJECTED;
}
