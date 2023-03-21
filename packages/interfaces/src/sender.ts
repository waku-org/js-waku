import type { IEncoder, IMessage } from "./message.js";
import type { ProtocolOptions, SendResult } from "./protocols.js";

export interface ISender {
  send: (
    encoder: IEncoder,
    message: IMessage,
    opts?: ProtocolOptions
  ) => Promise<SendResult>;
}
