import { ICodec, IDecodedMessage } from "@waku/interfaces";

export type RequestId = string;

export interface IAckManager {
  start(): void;
  stop(): void;
  subscribe(codec: ICodec<IDecodedMessage>): Promise<boolean>;
}
