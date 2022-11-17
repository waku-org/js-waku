import { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";
import { PointToPointProtocol, ProtocolOptions } from "@waku/interfaces";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import {
  PeerExchangeQuery,
  PeerExchangeResponse,
} from "../../proto/peer_exchange";
import { selectConnection } from "../select_connection";
import { getPeersForProtocol } from "../select_peer";

import { PeerExchangeRPC } from "./peer_exchange_rpc";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-beta1";

interface PeerExchangeQueryParams extends PeerExchangeQuery {
  peer: Peer;
}

export interface PeerExchangeComponents {
  connectionManager: ConnectionManager;
  peerStore: PeerStore;
}

class WakuPeerExchange implements PointToPointProtocol {
  constructor(
    public components: PeerExchangeComponents,
    public createOptions: ProtocolOptions
  ) {}

  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.components.peerStore, [PeerExchangeCodec]);
  }

  get peerStore(): PeerStore {
    return this.components.peerStore;
  }

  async query(params: PeerExchangeQueryParams): Promise<PeerExchangeResponse> {
    const { peer, numPeers } = params;

    const connections = this.components.connectionManager.getConnections(
      peer.id
    );
    const connection = selectConnection(connections);

    if (!connection) throw "Failed to get a connection to the peer";

    const stream = await connection.newStream(PeerExchangeCodec);

    const rpcQuery = PeerExchangeRPC.createRequest({ numPeers });

    const res = await pipe(
      [rpcQuery.encode()],
      lp.encode(),
      stream,
      lp.decode(),
      async (source) => await all(source)
    );

    const bytes = new Uint8ArrayList();
    res.forEach((chunk) => {
      bytes.append(chunk);
    });

    const response = PeerExchangeRPC.decode(bytes).response;

    if (!response) {
      throw new Error("Failed to decode response");
    }

    return response;
  }
}

export function wakuStore(
  init: Partial<ProtocolOptions> = {}
): (components: PeerExchangeComponents) => WakuPeerExchange {
  return (components: PeerExchangeComponents) =>
    new WakuPeerExchange(components, init);
}
