// Light Push V3 Protocol Types and Constants

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
