import type { IDecodedMessage, IDecoder } from "./message.js";
import type {
  Callback,
  PointToPointProtocol,
  ProtocolOptions,
} from "./protocols.js";

export interface IFilter extends PointToPointProtocol {
  subscribe: <T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Promise<() => Promise<void>>;
}
