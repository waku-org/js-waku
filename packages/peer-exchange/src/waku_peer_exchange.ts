import type { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { PeerStore } from "@libp2p/interface-peer-store";
import type {
  IncomingStreamData,
  Registrar,
} from "@libp2p/interface-registrar";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import { ENR } from "@waku/enr";
import type {
  IPeerExchange,
  PeerExchangeQueryParams,
  PeerExchangeResponse,
} from "@waku/interfaces";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";

import { PeerExchangeRPC } from "./rpc.js";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

const log = debug("waku:peer-exchange");

export interface PeerExchangeComponents {
  peerStore: PeerStore;
  registrar: Registrar;
  connectionManager: ConnectionManager;
}

/**
 * Implementation of the Peer Exchange protocol (https://rfc.vac.dev/spec/34/)
 */
export class WakuPeerExchange extends BaseProtocol implements IPeerExchange {
  private callback:
    | ((response: PeerExchangeResponse) => Promise<void>)
    | undefined;

  /**
   * @param components - libp2p components
   */
  constructor(public components: PeerExchangeComponents) {
    super(
      PeerExchangeCodec,
      components.peerStore,
      components.connectionManager.getConnections.bind(
        components.connectionManager
      )
    );
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
