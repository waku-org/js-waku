import type { IDecodedMessage } from "./message.js";
import { ProtocolError } from "./protocols.js";

export interface IAsyncIterator<T extends IDecodedMessage> {
  iterator: AsyncIterator<T>;
  stop: Unsubscribe;
}

export type Unsubscribe = () => void | Promise<void>;

export type PubsubTopic = string;
export type ContentTopic = string;

export type PeerIdStr = string;

// SK = success key name
// SV = success value type
// EK = error key name (default: "error")
// EV = error value type (default: ProtocolError)
export type ThisOrThat<
  SK extends string,
  SV,
  EK extends string = "error",
  EV = ProtocolError
> =
  | ({ [key in SK]: SV } & { [key in EK]: null })
  | ({ [key in SK]: null } & { [key in EK]: EV });

export type ThisAndThat<
  SK extends string,
  SV,
  EK extends string = "error",
  EV = ProtocolError
> = { [key in SK]: SV } & { [key in EK]: EV };
