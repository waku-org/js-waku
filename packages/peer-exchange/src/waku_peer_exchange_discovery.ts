import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  symbol,
} from "@libp2p/interface-peer-discovery";
import { PeerInfo } from "@libp2p/interface-peer-info";
import { EventEmitter } from "@libp2p/interfaces/events";
import { PeerExchangeComponents } from "@waku/interfaces";
import debug from "debug";

import { PeerExchangeCodec } from "./waku_peer_exchange";

const log = debug("waku:peer-exchange-discovery");

interface Options {
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

export class PeerExchangeDiscovery
  extends EventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private readonly components: PeerExchangeComponents;
  private readonly options: Options;
  private isStarted: boolean;

  constructor(components: PeerExchangeComponents, options: Options) {
    super();
    this.components = components;
    this.options = options;
    this.isStarted = false;
  }

  /**
   * Start emitting events
   */
  start(): void {
    if (this.isStarted) {
      return;
    }

    log("Starting peer exchange node discovery, discovering peers");

    this.components.peerStore.addEventListener(
      "change:protocols",
      async (event) => {
        const { protocols } = event.detail;
        if (!protocols.includes(PeerExchangeCodec)) return;

        const { peerId } = event.detail;
        const peer = await this.components.peerStore.get(peerId);
        const peerInfo = {
          id: peerId,
          multiaddrs: peer.addresses.map((address) => address.multiaddr),
          protocols: [],
        };
        await this.components.peerStore.tagPeer(
          peerId,
          DEFAULT_BOOTSTRAP_TAG_NAME,
          {
            value: this.options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
            ttl: this.options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL,
          }
        );
        this.dispatchEvent(
          new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
        );
      }
    );
  }

  /**
   * Remove event listener
   */
  stop(): void {
    if (!this.isStarted) return;
    log("Stopping peer exchange node discovery");
    this.components.peerStore.removeEventListener("change:protocols");
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }
}
