import { IEncoder, IMessage } from "./message.js";
import { LightPushSDKResult } from "./protocols.js";
import type { ISendOptions } from "./sender.js";

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

export type ILightPush = {
  readonly multicodec: string[];
  start: () => void;
  stop: () => void;
  send: (encoder: IEncoder, message: IMessage) => Promise<LightPushSDKResult>;
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
