import type { IEncoder, IMessage } from "./message.js";
import { ProtocolUseOptions, SDKProtocolResult } from "./protocols.js";

export interface ISender {
  send: (
    encoder: IEncoder,
    message: IMessage,
    sendOptions?: ProtocolUseOptions
  ) => Promise<SDKProtocolResult>;
}
