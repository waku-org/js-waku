import type { PeerId, Stream } from "@libp2p/interface";
import type { MultiaddrInput } from "@multiformats/multiaddr";

import { IConnectionManager } from "./connection_manager.js";
import type { IFilter } from "./filter.js";
import { IHealthManager } from "./health_manager.js";
import type { Libp2p } from "./libp2p.js";
import type { ILightPush } from "./light_push.js";
import { Protocols } from "./protocols.js";
import type { IRelay } from "./relay.js";
import type { IStore } from "./store.js";

export interface IWaku {
  libp2p: Libp2p;
  relay?: IRelay;
  store?: IStore;
  filter?: IFilter;
  lightPush?: ILightPush;

  health: IHealthManager;
  connectionManager: IConnectionManager;

  dial(peer: PeerId | MultiaddrInput, protocols?: Protocols[]): Promise<Stream>;

  start(): Promise<void>;

  stop(): Promise<void>;

  connect(): Promise<void>;

  isStarted(): boolean;

  isConnected(): boolean;
}

export interface LightNode extends IWaku {
  relay: undefined;
  store: IStore;
  filter: IFilter;
  lightPush: ILightPush;
}

export interface RelayNode extends IWaku {
  relay: IRelay;
  store: undefined;
  filter: undefined;
  lightPush: undefined;
}
