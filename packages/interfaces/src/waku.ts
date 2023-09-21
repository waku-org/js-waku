import type { Stream } from "@libp2p/interface/connection";
import type { PeerId } from "@libp2p/interface/peer-id";
import type { Multiaddr } from "@multiformats/multiaddr";

import { IConnectionManager } from "./connection_manager";
import type { IFilter } from "./filter";
import type { Libp2p } from "./libp2p";
import type { ILightPush } from "./light_push";
import { Protocols } from "./protocols";
import type { IRelay } from "./relay";
import type { IStore } from "./store";

export interface Waku {
  libp2p: Libp2p;
  relay?: IRelay;
  store?: IStore;
  filter?: IFilter;
  lightPush?: ILightPush;

  connectionManager: IConnectionManager;

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
}

export interface RelayNode extends Waku {
  relay: IRelay;
  store: undefined;
  filter: undefined;
  lightPush: undefined;
}

export interface FullNode extends Waku {
  relay: IRelay;
  store: IStore;
  filter: IFilter;
  lightPush: ILightPush;
}
