import type { Stream } from "@libp2p/interface-connection";
import { PeerId } from "@libp2p/interface-peer-id";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol,
} from "@waku/core";
import { ENR } from "@waku/enr";
import {
  PeerExchange,
  PeerExchangeComponents,
  PeerExchangeQueryParams,
  PeerExchangeResponse,
  ProtocolOptions,
} from "@waku/interfaces";
// import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { PeerExchangeRPC } from "./rpc.js";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

// const log = debug("waku:peer-exchange");

const isDefined = (enr: ENR | undefined): enr is ENR => {
  return !!enr;
};

export class WakuPeerExchange implements PeerExchange {
  constructor(
    public components: PeerExchangeComponents,
    public createOptions: ProtocolOptions
  ) {
    // this.components.registrar
    //   .handle(PeerExchangeCodec, this.onRequest.bind(this))
    //   .catch((e) => log("Failed to register peer exchange protocol", e));
  }

  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.components.peerStore, [PeerExchangeCodec]);
  }

  get peerStore(): PeerStore {
    return this.components.peerStore;
  }

  async query(params: PeerExchangeQueryParams): Promise<PeerExchangeResponse> {
    const { numPeers } = params;

    const rpcQuery = PeerExchangeRPC.createRequest({ numPeers });

    const peer = await this.getPeer();

    const stream = await this.newStream(peer);

    const pipeResponse = await pipe(
      [rpcQuery.encode()],
      lp.encode(),
      stream,
      lp.decode(),
      async (source) => await all(source)
    );

    const bytes = new Uint8ArrayList();
    pipeResponse.forEach((chunk) => {
      bytes.append(chunk);
    });

    const decoded = PeerExchangeRPC.decode(bytes).response;

    if (!decoded) {
      throw new Error("Failed to decode response");
    }

    const { peerInfos } = decoded;
    const enrPromises: Promise<ENR>[] = [];

    for (const peerInfo of peerInfos) {
      if (!peerInfo.ENR) continue;
      const enr = ENR.decode(peerInfo.ENR);
      enrPromises.push(enr);
    }

    const _peerInfos = (await Promise.all(enrPromises))
      .filter(isDefined)
      .map((enr) => {
        return { ENR: enr };
      });

    return { peerInfos: _peerInfos };
  }

  // private onRequest(streamData: IncomingStreamData): void {
  //   const { stream } = streamData;
  //   pipe(stream, lp.decode(), async (source) => {
  //     for await (const bytes of source) {
  //       const decoded = PeerExchangeRPC.decode(bytes).response;

  //       if (!decoded) {
  //         throw new Error("Failed to decode response");
  //       }

  //       const enrs = await Promise.all(
  //         decoded.peerInfos.map(({ ENR: _ENR }) => _ENR && ENR.decode(_ENR))
  //       );

  //       const peerInfos = enrs.map((enr) => {
  //         return {
  //           ENR: enr,
  //         };
  //       });
  //     }
  //   });
  // }

  private async getPeer(peerId?: PeerId): Promise<Peer> {
    const res = await selectPeerForProtocol(
      this.components.peerStore,
      [PeerExchangeCodec],
      peerId
    );
    if (!res) {
      throw new Error(`Failed to select peer for ${PeerExchangeCodec}`);
    }
    return res.peer;
  }

  private async newStream(peer: Peer): Promise<Stream> {
    const connections = this.components.connectionManager.getConnections(
      peer.id
    );
    const connection = selectConnection(connections);
    if (!connection) {
      throw new Error("Failed to get a connection to the peer");
    }

    return connection.newStream(PeerExchangeCodec);
  }
}

export function wakuPeerExchange(
  init: Partial<ProtocolOptions> = {}
): (components: PeerExchangeComponents) => WakuPeerExchange {
  return (components: PeerExchangeComponents) =>
    new WakuPeerExchange(components, init);
}
