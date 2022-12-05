import type { Encoder, Message } from "./message.js";
import type {
  PointToPointProtocol,
  ProtocolOptions,
  SendResult,
} from "./protocols.js";

export interface LightPush extends PointToPointProtocol {
  push: (
    encoder: Encoder,
    message: Message,
    opts?: ProtocolOptions
  ) => Promise<SendResult>;
}
