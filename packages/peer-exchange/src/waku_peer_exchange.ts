import type { ConnectionManager } from "@libp2p/interface-connection-manager";
import type { PeerStore } from "@libp2p/interface-peer-store";
import { BaseProtocol } from "@waku/core/lib/base_protocol";
import { EnrDecoder } from "@waku/enr";
import type {
  IPeerExchange,
  PeerExchangeQueryParams,
  PeerInfo,
} from "@waku/interfaces";
import debug from "debug";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { PeerExchangeRPC } from "./rpc.js";

export const PeerExchangeCodec = "/vac/waku/peer-exchange/2.0.0-alpha1";

const log = debug("waku:peer-exchange");

export interface PeerExchangeComponents {
  peerStore: PeerStore;
  connectionManager: ConnectionManager;
}

/**
 * Implementation of the Peer Exchange protocol (https://rfc.vac.dev/spec/34/)
 */
export class WakuPeerExchange extends BaseProtocol implements IPeerExchange {
  multicodec: string;

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
    this.multicodec = PeerExchangeCodec;
  }

  /**
   * Make a peer exchange query to a peer
   */
  async query(params: PeerExchangeQueryParams): Promise<PeerInfo[]> {
    const { numPeers } = params;

    const rpcQuery = PeerExchangeRPC.createRequest({
      numPeers,
    });

    const peer = await this.getPeer(params.peerId);

    const stream = await this.newStream(peer);

    const res = await pipe(
      [rpcQuery.toBinary()],
      lp.encode(),
      stream,
      lp.decode(),
      async (source) => await all(source)
    );

    try {
      const bytes = new Uint8ArrayList();
      res.forEach((chunk) => {
        bytes.append(chunk);
      });

      const decoded = PeerExchangeRPC.decode(bytes).response;

      if (!decoded) {
        throw new Error("Failed to decode response");
      }

      const enrs = await Promise.all(
        decoded.peerInfos.map(
          (peerInfo) => peerInfo.enr && EnrDecoder.fromRLP(peerInfo.enr)
        )
      );

      const peerInfos = enrs.map((enr) => {
        return {
          ENR: enr,
        };
      });

      return peerInfos;
    } catch (err) {
      log("Failed to decode push reply", err);
      throw new Error("Failed to decode push reply");
    }
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
