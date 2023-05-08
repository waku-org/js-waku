import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import type { PeerIdStr, TopicStr } from "@chainsafe/libp2p-gossipsub/types";

import { IDecodedMessage, IDecoder } from "./message.js";
import { Callback, ProtocolOptions } from "./protocols.js";
import { IReceiver } from "./receiver.js";
import type { ISender } from "./sender.js";

interface IRelayAPI {
  readonly gossipSub: GossipSub;
  start: () => Promise<void>;
  getMeshPeers: (topic?: TopicStr) => PeerIdStr[];
}

export type IRelay = IRelayAPI &
  ISender &
  Omit<IReceiver<"v1">, "unsubscribeAll" | "subscribe"> & {
    subscribe: <T extends IDecodedMessage>(
      decoders: IDecoder<T> | IDecoder<T>[],
      callback: Callback<T>,
      opts?: ProtocolOptions
    ) => () => void;
  };
