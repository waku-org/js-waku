import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  symbol,
} from "@libp2p/interface-peer-discovery";
import { PeerInfo } from "@libp2p/interface-peer-info";
import { EventEmitter } from "@libp2p/interfaces/events";
import { PeerExchangeComponents, PeerExchangeResponse } from "@waku/interfaces";
import debug from "debug";

import { WakuPeerExchange } from "./waku_peer_exchange";

const log = debug("waku:peer-exchange-discovery");

interface Options {
  /**
   * The number of peers to request for.
   */
  numPeers: number;
  /**
   * How long to wait before discovering bootstrap nodes
   */
  timeout?: number;

  /**
   * Tag a bootstrap peer with this name before "discovering" it (default: 'bootstrap')
   */
  tagName?: string;

  /**
   * The bootstrap peer tag will have this value (default: 50)
   */
  tagValue?: number;

  /**
   * Cause the bootstrap peer tag to be removed after this number of ms (default: 2 minutes)
   */
  tagTTL?: number;
}

const DEFAULT_BOOTSTRAP_TAG_NAME = "peer-exchange";
const DEFAULT_BOOTSTRAP_TAG_VALUE = 50;
const DEFAULT_BOOTSTRAP_TAG_TTL = 120000;
const DEFAULT_BOOTSTRAP_DISCOVERY_TIMEOUT = 1000;

export class PeerExchangeDiscovery
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private timer?: ReturnType<typeof setTimeout>;
  private readonly components: PeerExchangeComponents;
  private readonly options: Options;
  private readonly timeout: number;
  private readonly peerExchange: WakuPeerExchange;

  constructor(
    components: PeerExchangeComponents,
    options: Options = { numPeers: 3 }
  ) {
    super();
    this.components = components;
    this.options = options;
    this.timeout = DEFAULT_BOOTSTRAP_DISCOVERY_TIMEOUT;
    this.peerExchange = new WakuPeerExchange(this.components);
  }

  /**
   * Start emitting events
   */
  start(): void {
    if (this.isStarted()) {
      return;
    }

    log(
      "Starting bootstrap node discovery, discovering peers after %s ms",
      this.timeout
    );
    this.timer = setTimeout(() => {
      this.requestPeers();
    }, this.timeout);
  }

  /**
   * Stop emitting events
   */
  stop(): void {
    if (this.timer != null) {
      clearTimeout(this.timer);
    }

    this.timer = undefined;
  }

  requestPeers(): void {
    this.peerExchange.query(
      { numPeers: BigInt(1) },
      this._callbackToEmit.bind(this)
    );
  }

  /**
   * Emit address as a PeerInfo
   */
  async _callbackToEmit(response: PeerExchangeResponse): Promise<void> {
    if (this.timer == null) {
      return;
    }

    const { peerInfos } = response;

    peerInfos.forEach(async (peerInfo) => {
      const { ENR } = peerInfo;
      if (!ENR) return;

      const peerData = {
        id: ENR.peerId,
        multiaddrs: ENR.multiaddrs,
        protocols: [],
      };

      if (
        !peerData ||
        !peerData.id ||
        !peerData.multiaddrs ||
        peerData.multiaddrs.length === 0
      )
        return;

      await this.components.peerStore.tagPeer(
        peerData.id,
        DEFAULT_BOOTSTRAP_TAG_NAME,
        {
          value: this.options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
          ttl: this.options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL,
        }
      );

      // check we are still running
      if (this.timer == null) {
        return;
      }

      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", { detail: peerData as PeerInfo })
      );
    });
  }

  isStarted(): boolean {
    return Boolean(this.timer);
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }
}
