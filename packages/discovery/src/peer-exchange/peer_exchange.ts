import { StreamManager } from "@waku/core";
import { EnrDecoder } from "@waku/enr";
import {
  IPeerExchange,
  Libp2pComponents,
  PeerExchangeQueryParams,
  PeerExchangeQueryResult,
  ProtocolError
} from "@waku/interfaces";
import { isDefined } from "@waku/utils";
import { Logger } from "@waku/utils";
import all from "it-all";
import * as lp from "it-length-prefixed";
import { pipe } from "it-pipe";
import { Uint8ArrayList } from "uint8arraylist";

import { PeerExchangeCodec } from "./constants.js";
import { PeerExchangeRPC } from "./rpc.js";

const log = new Logger("peer-exchange");

/**
 * Implementation of the Peer Exchange protocol (https://rfc.vac.dev/spec/34/)
 */
export class PeerExchange implements IPeerExchange {
  private readonly streamManager: StreamManager;

  /**
   * @param components - libp2p components
   */
  public constructor(private readonly components: Libp2pComponents) {
    this.streamManager = new StreamManager(PeerExchangeCodec, components);
  }

  /**
   * Make a peer exchange query to a peer
   */
  public async query(
    params: PeerExchangeQueryParams
  ): Promise<PeerExchangeQueryResult> {
    const { numPeers, peerId } = params;

    const rpcQuery = PeerExchangeRPC.createRequest({
      numPeers: BigInt(numPeers)
    });

    const hasPeer = await this.components.peerStore.has(peerId);
    if (!hasPeer) {
      return {
        peerInfos: null,
        error: ProtocolError.NO_PEER_AVAILABLE
      };
    }

    const stream = await this.streamManager.getStream(peerId);

    if (!stream) {
      log.error(`Failed to get a stream for remote peer:${peerId.toString()}`);
      return {
        peerInfos: null,
        error: ProtocolError.NO_STREAM_AVAILABLE
      };
    }

    const res = await pipe(
      [rpcQuery.encode()],
      lp.encode,
      stream,
      lp.decode,
      async (source) => await all(source)
    );

    try {
      const bytes = new Uint8ArrayList();
      res.forEach((chunk) => {
        bytes.append(chunk);
      });

      const { response } = PeerExchangeRPC.decode(bytes);
      if (!response) {
        log.error(
          "PeerExchangeRPC message did not contains a `response` field"
        );
        return {
          peerInfos: null,
          error: ProtocolError.EMPTY_PAYLOAD
        };
      }

      const peerInfos = await Promise.all(
        response.peerInfos
          .map((peerInfo) => peerInfo.enr)
          .filter(isDefined)
          .map(async (enr) => {
            return { ENR: await EnrDecoder.fromRLP(enr) };
          })
      );

      return {
        peerInfos,
        error: null
      };
    } catch (err) {
      log.error("Failed to decode push reply", err);
      return {
        peerInfos: null,
        error: ProtocolError.DECODE_FAILED
      };
    }
  }
}
