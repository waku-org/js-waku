import type { IDecodedMessage, IDecoder } from "../message.js";
import type { IBaseProtocolCore, IBaseProtocolSDK } from "../protocols.js";

export type StoreCursor = Uint8Array;

export type QueryRequestParams = {
  includeData: boolean;
  pubsubTopic: string;
  contentTopics: string[];
  timeStart?: Date;
  timeEnd?: Date;
  messageHashes?: Uint8Array[];
  cursor?: Uint8Array;
  paginationForward: boolean;
  paginationLimit?: number;
};

export type IStoreCore = IBaseProtocolCore;

export type IStoreSDK = IBaseProtocolSDK & {
  protocol: IBaseProtocolCore;
  createCursor(message: IDecodedMessage): StoreCursor;
  queryGenerator: <T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    options?: QueryRequestParams
  ) => AsyncGenerator<Promise<T | undefined>[]>;

  queryWithOrderedCallback: <T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: (message: T) => Promise<void | boolean> | boolean | void,
    options?: QueryRequestParams
  ) => Promise<void>;
  queryWithPromiseCallback: <T extends IDecodedMessage>(
    decoders: IDecoder<T>[],
    callback: (
      message: Promise<T | undefined>
    ) => Promise<void | boolean> | boolean | void,
    options?: QueryRequestParams
  ) => Promise<void>;
};
