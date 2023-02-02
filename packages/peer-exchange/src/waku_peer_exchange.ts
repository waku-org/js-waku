import type { Stream } from "@libp2p/interface-connection";
import type { PeerId } from "@libp2p/interface-peer-id";
import type { Peer, PeerStore } from "@libp2p/interface-peer-store";
import type { IncomingStreamData } from "@libp2p/interface-registrar";
import { ENR } from "@waku/enr";
import type {
  IPeerExchange,
  PeerExchangeComponents,
  PeerExchangeQueryParams,
  PeerExchangeResponse,
} from "@waku/interfaces";
import {
  getPeersForProtocol,
  selectConnection,
  selectPeerForProtocol,
} from "@waku/libp2p-utils";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { PeerExchangeRPC } from "./rpc.js";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

const log = debug("waku:peer-exchange");

/**
 * Implementation of the Peer Exchange protocol (https://rfc.vac.dev/spec/34/)
 */
export class WakuPeerExchange implements IPeerExchange {
  multicodec: string;
  private callback:
    | ((response: PeerExchangeResponse) => Promise<void>)
    | undefined;

  /**
   * @param components - libp2p components
   */
  constructor(public components: PeerExchangeComponents) {
    this.multicodec = PeerExchangeCodec;
    this.components.registrar
      .handle(PeerExchangeCodec, this.handler.bind(this))
      .catch((e) => log("Failed to register peer exchange protocol", e));
  }

  /**
   * Make a peer exchange query to a peer
   */
  async query(
    params: PeerExchangeQueryParams,
    callback: (response: PeerExchangeResponse) => Promise<void>
  ): Promise<void> {
    this.callback = callback;

    const { numPeers } = params;

    const rpcQuery = PeerExchangeRPC.createRequest({
      numPeers: BigInt(numPeers),
    });

    const peer = await this.getPeer(params.peerId);

    const stream = await this.newStream(peer);

    await pipe(
      [rpcQuery.encode()],
      lp.encode(),
      stream,
      lp.decode(),
      async (source) => await all(source)
    );
  }

  /**
   * Handle a peer exchange query response
   */
  private handler(streamData: IncomingStreamData): void {
    const { stream } = streamData;
    pipe(stream, lp.decode(), async (source) => {
      for await (const bytes of source) {
        const decoded = PeerExchangeRPC.decode(bytes).response;

        if (!decoded) {
          throw new Error("Failed to decode response");
        }

        const enrs = await Promise.all(
          decoded.peerInfos.map(
            (peerInfo) => peerInfo.enr && ENR.decode(peerInfo.enr)
          )
        );

        const peerInfos = enrs.map((enr) => {
          return {
            ENR: enr,
          };
        });

        if (!this.callback) throw new Error("Callback not set");

        await this.callback({ peerInfos });
      }
    }).catch((err) => log("Failed to handle peer exchange request", err));
  }

  /**
   *
   * @param peerId - Optional peer ID to select a peer
   * @returns A peer to query
   */
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

  /**
   * @param peer - Peer to open a stream with
   * @returns A new stream
   */
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

  /**
   * @returns All peers that support the peer exchange protocol
   */
  async peers(): Promise<Peer[]> {
    return getPeersForProtocol(this.components.peerStore, [PeerExchangeCodec]);
  }

  /**
   * @returns The libp2p peer store
   */
  get peerStore(): PeerStore {
    return this.components.peerStore;
  }
}

/**
 *
 * @returns A function that creates a new peer exchange protocol
 */
export function wakuPeerExchange(): (
  components: PeerExchangeComponents
) => WakuPeerExchange {
  return (components: PeerExchangeComponents) =>
    new WakuPeerExchange(components);
}
