import type { IDecodedMessage } from "./message.js";

export interface IAsyncIterator<T extends IDecodedMessage> {
  iterator: AsyncIterator<T>;
  stop: Unsubscribe;
}

export type Unsubscribe = () => void | Promise<void>;

export type PubsubTopic = string;
export type ContentTopic = string;

export type PeerIdStr = string;
