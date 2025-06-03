import { ProtocolError } from "@waku/interfaces";

export enum LightPushStatusCode {
  SUCCESS = 200,
  BAD_REQUEST = 400,
  UNSUPPORTED_PUBSUB_TOPIC = 404,
  REQUEST_TOO_LARGE = 413,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  NO_PEERS_TO_RELAY = 503
}

export function lightPushStatusCodeToProtocolError(
  statusCode: number
): ProtocolError | null {
  switch (statusCode) {
    case LightPushStatusCode.SUCCESS:
      return null;

    case LightPushStatusCode.BAD_REQUEST:
      return ProtocolError.GENERIC_FAIL;

    case LightPushStatusCode.UNSUPPORTED_PUBSUB_TOPIC:
      return ProtocolError.TOPIC_NOT_CONFIGURED;

    case LightPushStatusCode.REQUEST_TOO_LARGE:
      return ProtocolError.SIZE_TOO_BIG;

    case LightPushStatusCode.TOO_MANY_REQUESTS:
      return ProtocolError.GENERIC_FAIL;

    case LightPushStatusCode.INTERNAL_SERVER_ERROR:
      return ProtocolError.REMOTE_PEER_REJECTED;

    case LightPushStatusCode.NO_PEERS_TO_RELAY:
      return ProtocolError.NO_PEER_AVAILABLE;

    default:
      return ProtocolError.REMOTE_PEER_REJECTED;
  }
}

export const lightPushStatusDescriptions: Record<number, string> = {
  [LightPushStatusCode.SUCCESS]: "Message pushed successfully",
  [LightPushStatusCode.BAD_REQUEST]:
    "Invalid request format or missing required fields",
  [LightPushStatusCode.UNSUPPORTED_PUBSUB_TOPIC]:
    "The specified pubsub topic is not supported",
  [LightPushStatusCode.REQUEST_TOO_LARGE]:
    "Message size exceeds maximum allowed size",
  [LightPushStatusCode.TOO_MANY_REQUESTS]:
    "Rate limit exceeded, too many requests",
  [LightPushStatusCode.INTERNAL_SERVER_ERROR]: "Internal server error occurred",
  [LightPushStatusCode.NO_PEERS_TO_RELAY]:
    "No relay peers available to forward the message"
};

export function isSuccessStatusCode(statusCode: number): boolean {
  return statusCode === LightPushStatusCode.SUCCESS;
}

export function getLightPushStatusDescription(
  statusCode: number,
  statusDesc?: string
): string {
  return (
    statusDesc ||
    lightPushStatusDescriptions[statusCode] ||
    `Unknown status code: ${statusCode}`
  );
}
