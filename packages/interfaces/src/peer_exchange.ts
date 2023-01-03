import type { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type { Registrar } from "@libp2p/interface-registrar";

import { IEnr } from "./enr.js";
import { PointToPointProtocol } from "./protocols.js";

export interface IPeerExchange extends PointToPointProtocol {
  query(
    params: PeerExchangeQueryParams,
    callback: (response: PeerExchangeResponse) => Promise<void> | void
  ): Promise<void>;
}

export interface PeerExchangeQueryParams {
  numPeers: number;
  peerId?: PeerId;
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
  registrar: Registrar;
}
