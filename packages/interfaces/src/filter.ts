import type { DecodedMessage, Decoder } from "./message.js";
import type {
  Callback,
  PointToPointProtocol,
  ProtocolOptions,
} from "./protocols.js";

export interface Filter extends PointToPointProtocol {
  subscribe: <T extends DecodedMessage>(
    decoders: Decoder<T>[],
    callback: Callback<T>,
    opts?: ProtocolOptions
  ) => Promise<() => Promise<void>>;
}
