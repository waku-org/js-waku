import type { IEncoder, IMessage } from "./message.js";
import { SDKProtocolResult } from "./protocols.js";

export interface ISender {
  send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: SendOptions
  ) => Promise<SDKProtocolResult>;
}

export type SendOptions = {
  autoRetry?: boolean;
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
};
