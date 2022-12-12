import type { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type { Registrar } from "@libp2p/interface-registrar";
import { ENR } from "@waku/enr";

import { PointToPointProtocol } from "./protocols.js";

export interface PeerExchange extends PointToPointProtocol {
  query(
    params: PeerExchangeQueryParams,
    callback: (response: PeerExchangeResponse) => Promise<void> | void
  ): Promise<void>;
}

export interface PeerExchangeQueryParams {
  numPeers: number;
}

export interface PeerExchangeResponse {
  peerInfos: PeerInfo[];
}

export interface PeerInfo {
  ENR?: ENR;
}

export interface PeerExchangeComponents {
  connectionManager: ConnectionManager;
  peerStore: PeerStore;
  registrar: Registrar;
}
