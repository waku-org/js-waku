import type { PeerId } from "@libp2p/interface-peer-id";
import type { PeerStore } from "@libp2p/interface-peer-store";

import type { IEnr } from "./enr.js";
import { Libp2p } from "./libp2p.js";
import type { PointToPointProtocol } from "./protocols.js";

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
  getConnections: Libp2p["getConnections"];
  peerStore: PeerStore;
  addEventListener: Libp2p["addEventListener"];
  removeEventListener: Libp2p["removeEventListener"];
}
