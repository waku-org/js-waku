import { Libp2pComponents } from "./libp2p.js";
import type { IDecodedMessage } from "./message.js";

export interface IAsyncIterator<T extends IDecodedMessage> {
  iterator: AsyncIterator<T>;
  stop: Unsubscribe;
}

export type Unsubscribe = () => void | Promise<void>;

export type PubSubTopic = string;
export type ContentTopic = string;

export type PeerIdStr = string;

export interface PingServiceComponents {
  registrar: Libp2pComponents["registrar"];
  connectionManager: Libp2pComponents["connectionManager"];
}
