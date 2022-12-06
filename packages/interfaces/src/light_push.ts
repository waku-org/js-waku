import type { IEncoder, IMessage } from "./message.js";
import type {
  PointToPointProtocol,
  ProtocolOptions,
  SendResult,
} from "./protocols.js";

export interface ILightPush extends PointToPointProtocol {
  push: (
    encoder: IEncoder,
    message: IMessage,
    opts?: ProtocolOptions
  ) => Promise<SendResult>;
}
