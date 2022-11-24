import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  symbol,
} from "@libp2p/interface-peer-discovery";
import { PeerInfo } from "@libp2p/interface-peer-info";
import { EventEmitter } from "@libp2p/interfaces/dist/src/events";
import debug from "debug";

const log = debug("waku:peer-discovery-dns");

export class PeerExchangeDiscovery
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private _started: boolean;

  constructor(public peerExchange: WakuPeerExchange, public numPeers: number) {
    super();
    this._started = false;
  }

  /**
   * Start discovery process
   */
  async start(): Promise<void> {
    log("Starting peer discovery via Peer Exchange");

    this._started = true;

    const response = await this.peerExchange.query({
      numPeers: BigInt(this.numPeers),
    });

    response.peerInfos.forEach((peerInfo) => {
      if (!peerInfo.ENR) return;

      const _peerInfos = multiaddrsToPeerInfo(peerInfo.ENR.getFullMultiaddrs());

      _peerInfos.forEach((peerInfo) => {
        if (!this._started) return;
        this.dispatchEvent(
          new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
        );
      });
    });
  }

  /**
   * Stop emitting events
   */
  stop(): void {
    this._started = false;
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }
}
