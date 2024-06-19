import type { IEncoder, IMessage } from "./message.js";
import { SDKProtocolResult } from "./protocols.js";

export interface ISender {
  send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: SendOptions
  ) => Promise<SDKProtocolResult>;
}

/**
 * Options for using LightPush
 */
export type SendOptions = {
  /**
   * Optional flag to enable auto-retry with exponential backoff
   */
  autoRetry?: boolean;
  /**
   * Optional flag to force using all available peers
   */
  forceUseAllPeers?: boolean;
  /**
   * Optional maximum number of attempts for exponential backoff
   */
  maxAttempts?: number;
  /**
   * Optional initial delay in milliseconds for exponential backoff
   */
  initialDelay?: number;
  /**
   * Optional maximum delay in milliseconds for exponential backoff
   */
  maxDelay?: number;
};
