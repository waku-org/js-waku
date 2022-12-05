import type { GossipSub } from "@chainsafe/libp2p-gossipsub";

import type { DecodedMessage, Decoder, Encoder, Message } from "./message.js";
import type { Callback, SendResult } from "./protocols.js";

export interface Relay extends GossipSub {
  send: (encoder: Encoder, message: Message) => Promise<SendResult>;
  addObserver: <T extends DecodedMessage>(
    decoder: Decoder<T>,
    callback: Callback<T>
  ) => () => void;
  getMeshPeers: () => string[];
}
