import type { PeerId } from "@libp2p/interface";
import type { PeerStore } from "@libp2p/interface";
import type { ConnectionManager } from "@libp2p/interface-internal";

import { IEnr } from "./enr.js";
import { ThisOrThat } from "./misc.js";

export interface IPeerExchange {
  query(params: PeerExchangeQueryParams): Promise<PeerExchangeQueryResult>;
}

export type PeerExchangeQueryResult = ThisOrThat<"peerInfos", PeerInfo[]>;

export interface PeerExchangeQueryParams {
  numPeers: number;
  peerId: PeerId;
}

export interface PeerExchangeResponse {
  peerInfos: PeerInfo[];
}

export interface PeerInfo {
  ENR?: IEnr;
}

export interface PeerExchangeComponents {
  connectionManager: ConnectionManager;
  peerStore: PeerStore;
}
