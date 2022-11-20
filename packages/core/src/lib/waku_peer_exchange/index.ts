import { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";
import {
  PeerExchange,
  PeerExchangeQueryParams,
  PeerExchangeResponse,
  ProtocolOptions,
} from "@waku/interfaces";
// import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { selectConnection } from "../select_connection";
import { getPeersForProtocol, selectPeerForProtocol } from "../select_peer";

import { PeerExchangeRPC } from "./peer_exchange_rpc";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

export interface PeerExchangeComponents {
  connectionManager: ConnectionManager;
  peerStore: PeerStore;
}

class WakuPeerExchange implements PeerExchange {
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
    const { numPeers } = params;

    try {
      const peerRes = await selectPeerForProtocol(this.components.peerStore, [
        PeerExchangeCodec,
      ]);

      console.log("peer res");

      if (!peerRes) {
        throw new Error("No peer found");
      }

      const { peer } = peerRes;

      const connections = this.components.connectionManager.getConnections(
        peer.id
      );
      const connection = selectConnection(connections);

      if (!connection) throw "Failed to get a connection to the peer";

      const stream = await connection.newStream(PeerExchangeCodec);

      const rpcQuery = PeerExchangeRPC.createRequest({ numPeers });

      console.log("rpc query", rpcQuery);

      const res = await pipe(
        [rpcQuery.encode()],
        lp.encode(),
        stream,
        lp.decode(),
        async (source) => {
          console.log(source);
          // await all(source);
        }
      );

      console.log("pipe", res);

      const bytes = new Uint8ArrayList();
      // res.forEach((chunk) => {
      //   bytes.append(chunk);
      // });

      console.log("bytes");

      const response = PeerExchangeRPC.decode(bytes).response;

      console.log({ response });

      if (!response) {
        throw new Error("Failed to decode response");
      }

      return response;
    } catch (error) {
      console.error({ error });
      throw error;
    }
  }
}

export function wakuPeerExchange(
  init: Partial<ProtocolOptions> = {}
): (components: PeerExchangeComponents) => WakuPeerExchange {
  return (components: PeerExchangeComponents) =>
    new WakuPeerExchange(components, init);
}
