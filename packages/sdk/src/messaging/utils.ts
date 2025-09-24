import { IDecodedMessage, IDecoder, IEncoder } from "@waku/interfaces";

// TODO: create a local entity for that that will literally extend existing encoder and decoder from package/core
export type ICodec = IEncoder & IDecoder<IDecodedMessage>;

export interface IAckManager {
  start(): void;
  stop(): void;
  subscribe(codec: ICodec): Promise<boolean>;
}
