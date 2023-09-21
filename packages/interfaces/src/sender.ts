import type { IEncoder, IMessage } from "./message";
import type { SendResult } from "./protocols";

export interface ISender {
  send: (encoder: IEncoder, message: IMessage) => Promise<SendResult>;
}
