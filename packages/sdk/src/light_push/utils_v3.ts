import { LightPushStatusCodeV3 } from "@waku/interfaces";

const DEFAULT_BACKOFF_BASE = 2;
const MAX_BACKOFF_MS = 60_000;

export type V3StatusError = {
  statusCode?: number;
  retryAfter?: number;
};
export function shouldRetryV3(statusCode?: number): boolean {
  if (!statusCode) {
    return true;
  }

  switch (statusCode) {
    case LightPushStatusCodeV3.TOO_MANY_REQUESTS:
    case LightPushStatusCodeV3.SERVICE_NOT_AVAILABLE:
    case LightPushStatusCodeV3.INTERNAL_SERVER_ERROR:
    case LightPushStatusCodeV3.NO_PEERS_TO_RELAY:
      return true;

    case LightPushStatusCodeV3.BAD_REQUEST:
    case LightPushStatusCodeV3.PAYLOAD_TOO_LARGE:
    case LightPushStatusCodeV3.INVALID_MESSAGE_ERROR:
    case LightPushStatusCodeV3.UNSUPPORTED_PUBSUB_TOPIC:
    case LightPushStatusCodeV3.OUT_OF_RLN_PROOF:
      return false;

    default:
      return true;
  }
}

export function getRetryDelayForV3(
  error: V3StatusError,
  baseDelay: number,
  attemptNumber: number
): number {
  if (
    error.statusCode === LightPushStatusCodeV3.TOO_MANY_REQUESTS &&
    error.retryAfter
  ) {
    return error.retryAfter * 1000;
  }

  if (
    error.statusCode === LightPushStatusCodeV3.TOO_MANY_REQUESTS ||
    error.statusCode === LightPushStatusCodeV3.SERVICE_NOT_AVAILABLE
  ) {
    const delay = baseDelay * Math.pow(DEFAULT_BACKOFF_BASE, attemptNumber);
    return Math.min(delay, MAX_BACKOFF_MS);
  }

  return baseDelay;
}

export function shouldChangePeerForV3(statusCode?: number): boolean {
  return (
    statusCode === LightPushStatusCodeV3.SERVICE_NOT_AVAILABLE ||
    statusCode === LightPushStatusCodeV3.NO_PEERS_TO_RELAY
  );
}
