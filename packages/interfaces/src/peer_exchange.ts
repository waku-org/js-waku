import type { PeerStore } from "@libp2p/interface/peer-store";
import type { ConnectionManager } from "@libp2p/interface-internal/connection-manager";

import { IEnr } from "./enr.js";
import { IBaseProtocol } from "./protocols.js";

export interface IPeerExchange extends IBaseProtocol {
  query(params: PeerExchangeQueryParams): Promise<PeerInfo[] | undefined>;
}

export interface PeerExchangeQueryParams {
  numPeers: number;
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
