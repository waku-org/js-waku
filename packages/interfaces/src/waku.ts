import type { Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { Libp2p } from "libp2p";

import type { IFilter } from "./filter.js";
import type { ILightPush } from "./light_push.js";
import type { IPeerExchange } from "./peer_exchange.js";
import { Protocols } from "./protocols.js";
import type { IRelay } from "./relay.js";
import type { IStore } from "./store.js";

export interface Waku {
  libp2p: Libp2p;
  relay?: IRelay;
  store?: IStore;
  filter?: IFilter;
  lightPush?: ILightPush;
  peerExchange?: IPeerExchange;

  dial(peer: PeerId | Multiaddr, protocols?: Protocols[]): Promise<Stream>;

  start(): Promise<void>;

  stop(): Promise<void>;

  isStarted(): boolean;
}

export interface LightNode extends Waku {
  relay: undefined;
  store: IStore;
  filter: IFilter;
  lightPush: ILightPush;
  peerExchange: IPeerExchange;
}

export interface RelayNode extends Waku {
  relay: IRelay;
  store: undefined;
  filter: undefined;
  lightPush: undefined;
  peerExchange: undefined;
}

export interface FullNode extends Waku {
  relay: IRelay;
  store: IStore;
  filter: IFilter;
  lightPush: ILightPush;
  peerExchange: IPeerExchange;
}
