import { ProtocolError } from "./protocols.js";

export const LightPushCodecV3 = "/vac/waku/lightpush/3.0.0";

export enum LightPushStatusCodeV3 {
  SUCCESS = 200,
  BAD_REQUEST = 400,
  PAYLOAD_TOO_LARGE = 413,
  INVALID_MESSAGE_ERROR = 420,
  UNSUPPORTED_PUBSUB_TOPIC = 421,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_NOT_AVAILABLE = 503,
  OUT_OF_RLN_PROOF = 504,
  NO_PEERS_TO_RELAY = 505
}

export function isSuccessStatusCodeV3(statusCode: number | undefined): boolean {
  return statusCode === LightPushStatusCodeV3.SUCCESS;
}

export const lightPushStatusDescriptionsV3: Record<
  LightPushStatusCodeV3,
  string
> = {
  [LightPushStatusCodeV3.SUCCESS]: "Message sent successfully",
  [LightPushStatusCodeV3.BAD_REQUEST]: "Bad request format",
  [LightPushStatusCodeV3.PAYLOAD_TOO_LARGE]:
    "Message payload exceeds maximum size",
  [LightPushStatusCodeV3.INVALID_MESSAGE_ERROR]: "Message validation failed",
  [LightPushStatusCodeV3.UNSUPPORTED_PUBSUB_TOPIC]: "Unsupported pubsub topic",
  [LightPushStatusCodeV3.TOO_MANY_REQUESTS]: "Rate limit exceeded",
  [LightPushStatusCodeV3.INTERNAL_SERVER_ERROR]: "Internal server error",
  [LightPushStatusCodeV3.SERVICE_NOT_AVAILABLE]:
    "Service temporarily unavailable",
  [LightPushStatusCodeV3.OUT_OF_RLN_PROOF]: "RLN proof generation failed",
  [LightPushStatusCodeV3.NO_PEERS_TO_RELAY]: "No relay peers available"
};

export function lightPushStatusCodeToProtocolErrorV3(
  statusCode: LightPushStatusCodeV3 | number | undefined
): ProtocolError {
  if (!statusCode) {
    return ProtocolError.GENERIC_FAIL;
  }

  switch (statusCode) {
    case LightPushStatusCodeV3.SUCCESS:
      return ProtocolError.GENERIC_FAIL;

    case LightPushStatusCodeV3.BAD_REQUEST:
      return ProtocolError.REMOTE_PEER_REJECTED;

    case LightPushStatusCodeV3.PAYLOAD_TOO_LARGE:
      return ProtocolError.SIZE_TOO_BIG;

    case LightPushStatusCodeV3.INVALID_MESSAGE_ERROR:
      return ProtocolError.REMOTE_PEER_REJECTED;

    case LightPushStatusCodeV3.UNSUPPORTED_PUBSUB_TOPIC:
      return ProtocolError.TOPIC_NOT_CONFIGURED;

    case LightPushStatusCodeV3.TOO_MANY_REQUESTS:
      return ProtocolError.REMOTE_PEER_REJECTED;

    case LightPushStatusCodeV3.INTERNAL_SERVER_ERROR:
      return ProtocolError.GENERIC_FAIL;

    case LightPushStatusCodeV3.SERVICE_NOT_AVAILABLE:
      return ProtocolError.NO_PEER_AVAILABLE;

    case LightPushStatusCodeV3.OUT_OF_RLN_PROOF:
      return ProtocolError.RLN_PROOF_GENERATION;

    case LightPushStatusCodeV3.NO_PEERS_TO_RELAY:
      return ProtocolError.NO_PEER_AVAILABLE;

    default:
      return ProtocolError.REMOTE_PEER_REJECTED;
  }
}

export function getLightPushStatusDescriptionV3(
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
    lightPushStatusDescriptionsV3[statusCode as LightPushStatusCodeV3] ||
    `Unknown status code: ${statusCode}`
  );
}
