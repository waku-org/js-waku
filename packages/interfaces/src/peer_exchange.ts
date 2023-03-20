import type { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerStore } from "@libp2p/interface-peer-store";

import { IEnr } from "./enr.js";
import { PointToPointProtocol } from "./protocols.js";

export interface IPeerExchange extends PointToPointProtocol {
  query(params: PeerExchangeQueryParams): Promise<PeerInfo[] | undefined>;
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
}
