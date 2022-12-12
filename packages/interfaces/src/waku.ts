import type { Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { Libp2p } from "libp2p";

import type { Filter } from "./filter.js";
import type { LightPush } from "./light_push.js";
import type { PeerExchange } from "./peer_exchange.js";
import { Protocols } from "./protocols.js";
import type { Relay } from "./relay.js";
import type { Store } from "./store.js";

export interface Waku {
  libp2p: Libp2p;
  relay?: Relay;
  store?: Store;
  filter?: Filter;
  lightPush?: LightPush;
  peerExchange?: PeerExchange;

  dial(peer: PeerId | Multiaddr, protocols?: Protocols[]): Promise<Stream>;

  start(): Promise<void>;

  stop(): Promise<void>;

  isStarted(): boolean;
}

export interface WakuLight extends Waku {
  relay: undefined;
  store: Store;
  filter: Filter;
  lightPush: LightPush;
  peerExchange: PeerExchange;
}

export interface WakuPrivacy extends Waku {
  relay: Relay;
  store: undefined;
  filter: undefined;
  lightPush: undefined;
  peerExchange: undefined;
}

export interface WakuFull extends Waku {
  relay: Relay;
  store: Store;
  filter: Filter;
  lightPush: LightPush;
  peerExchange: PeerExchange;
}
