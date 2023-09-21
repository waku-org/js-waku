import type { IDecodedMessage } from "./message";

export interface IAsyncIterator<T extends IDecodedMessage> {
  iterator: AsyncIterator<T>;
  stop: Unsubscribe;
}

export type Unsubscribe = () => void | Promise<void>;

export type PubSubTopic = string;
export type ContentTopic = string;

export type PeerIdStr = string;
