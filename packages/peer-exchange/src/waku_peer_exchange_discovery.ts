import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  symbol,
} from "@libp2p/interface-peer-discovery";
import { EventEmitter } from "@libp2p/interfaces/events";
import debug from "debug";

import { WakuPeerExchange } from "./waku_peer_exchange";

const log = debug("waku:peer-exchange-discovery");

export class PeerExchangeDiscovery
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  constructor(public peerExchange: WakuPeerExchange, public numPeers: number) {
    super();
  }

  /**
   * Start discovery process
   */
  async start(): Promise<void> {
    log("Starting peer discovery via Waku Peer Exchange");

    await this.peerExchange.query({
      numPeers: BigInt(this.numPeers),
    });

    // response.peerInfos.forEach((peerInfo) => {
    //   if (!peerInfo.ENR) return;

    //   const _peerInfos = multiaddrsToPeerInfo(peerInfo.ENR.getFullMultiaddrs());

    //   _peerInfos.forEach((peerInfo) => {
    //     if (!this._started) return;
    //     this.dispatchEvent(
    //       new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
    //     );
    //   });
    // });
  }

  /**
   * Stop emitting events
   */
  stop(): void {
    throw new Error("Method not implemented.");
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }
}
