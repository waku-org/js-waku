import type { IEncoder, IMessage } from "./message.js";
import { SDKProtocolResult } from "./protocols.js";

export type ISendOptions = {
  /**
   * Enables retry of a message that was failed to be sent.
   * @default true
   */
  autoRetry?: boolean;

  /**
   * Sets number of attempts if `autoRetry` is enabled.
   * @default 3
   */
  maxAttempts?: number;
};

export interface ISender {
  send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: ISendOptions
  ) => Promise<SDKProtocolResult>;
}
