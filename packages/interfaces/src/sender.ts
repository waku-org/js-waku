import type { IEncoder, IMessage } from "./message.js";
import type { SendResult } from "./protocols.js";

export interface ISender {
  send: (encoder: IEncoder, message: IMessage) => Promise<SendResult>;
}
