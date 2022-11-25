import type { Stream } from "@libp2p/interface-connection";
import { PeerId } from "@libp2p/interface-peer-id";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";
import type { IncomingStreamData } from "@libp2p/interface-registrar";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol,
} from "@waku/core";
import {
  PeerExchange,
  PeerExchangeComponents,
  PeerExchangeQueryParams,
  PeerExchangeResponse,
  ProtocolOptions,
} from "@waku/interfaces";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { PeerExchangeRPC } from "./rpc";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

const log = debug("waku:peer-exchange");

export class WakuPeerExchange implements PeerExchange {
  private _pxResponse: PeerExchangeResponse | undefined;

  constructor(
    public components: PeerExchangeComponents,
    public createOptions: ProtocolOptions
  ) {
    this.components.registrar
      .handle(PeerExchangeCodec, this.onRequest.bind(this))
      .catch((e) => log("Failed to register peer exchange protocol", e));
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

    const res = await pipe(
      [rpcQuery.encode()],
      lp.encode(),
      stream,
      lp.decode(),
      async (source) => await all(source)
    );

    console.log({ res });

    return this._pxResponse!;

    // while (!this._pxResponse) {
    //   console.log("waiting for 1 sec", this._pxResponse);
    //   await new Promise((resolve) => setTimeout(resolve, 1000));
    // }

    // return this._pxResponse;
  }

  private onRequest(streamData: IncomingStreamData): void {
    log("Receiving message push");
    try {
      pipe(streamData.stream, lp.decode(), async (source) => {
        for await (const bytes of source) {
          console.log(bytes); // TODO: handle incoming message
        }
      }).then(
        () => {
          log("Receiving pipe closed.");
        },
        (e) => {
          log("Error with receiving pipe", e);
        }
      );
    } catch (e) {
      log("Error decoding message", e);
    }
  }

  // private onRequest(streamData: IncomingStreamData): void {
  //   const { stream } = streamData;
  //   console.log("received");
  //   pipe(stream, lp.decode(), async (source) => {
  //     for await (const bytes of source) {
  //       console.log({ bytes });
  //       // const decoded = PeerExchangeRPC.decode(bytes);
  //       // if (!decoded || !decoded.response) {
  //       //   throw new Error("Failed to decode response");
  //       // }

  //       // const enrPromises: Promise<ENR>[] = [];
  //       // for (const peerInfo of decoded.response.peerInfos) {
  //       //   if (!peerInfo.ENR) continue;
  //       //   const enr = ENR.decode(peerInfo.ENR);
  //       //   enrPromises.push(enr);
  //       // }
  //       // const peerInfos = (await Promise.all(enrPromises)).map((enr) => {
  //       //   return {
  //       //     ENR: enr,
  //       //   };
  //       // });

  //       // this._pxResponse = {
  //       //   peerInfos,
  //       // };
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
