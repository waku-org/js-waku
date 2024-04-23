import type { IEncoder, IMessage } from "./message.js";
import { SDKProtocolResult } from "./protocols.js";

export interface ISender {
  send: (encoder: IEncoder, message: IMessage) => Promise<SDKProtocolResult>;
}
