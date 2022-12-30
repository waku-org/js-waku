import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  symbol,
} from "@libp2p/interface-peer-discovery";
import { PeerId } from "@libp2p/interface-peer-id";
import { PeerInfo } from "@libp2p/interface-peer-info";
import { PeerProtocolsChangeData } from "@libp2p/interface-peer-store";
import { EventEmitter } from "@libp2p/interfaces/events";
import { PeerExchangeComponents } from "@waku/interfaces";
import debug from "debug";

import { WakuPeerExchange } from "./waku_peer_exchange";
import { PeerExchangeCodec } from "./waku_peer_exchange";

const log = debug("waku:peer-exchange-discovery");

const DEFAULT_PEER_EXCHANGE_REQUEST_NODES = 10;

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
  private readonly peerExchange: WakuPeerExchange;
  private readonly options: Options;
  private isStarted: boolean;
  private intervals: Map<PeerId, NodeJS.Timeout> = new Map();

  private readonly eventHandler = async (
    event: CustomEvent<PeerProtocolsChangeData>
  ): Promise<void> => {
    const { protocols, peerId } = event.detail;
    if (!protocols.includes(PeerExchangeCodec)) return;

    const interval = setInterval(async () => {
      await this.peerExchange.query(
        {
          numPeers: DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
          peerId,
        },
        async (response) => {
          const { peerInfos } = response;

          for (const _peerInfo of peerInfos) {
            const { ENR } = _peerInfo;
            if (!ENR) {
              log("no ENR");
              continue;
            }

            const { peerId, multiaddrs } = ENR;

            if (!peerId) {
              log("no peerId");
              continue;
            }
            if (!multiaddrs || multiaddrs.length === 0) {
              log("no multiaddrs");
              continue;
            }

            // check if peer is already in peerStore
            const existingPeer = await this.components.peerStore.get(peerId);
            if (existingPeer) {
              log("peer already in peerStore");
              continue;
            }

            await this.components.peerStore.tagPeer(
              peerId,
              DEFAULT_BOOTSTRAP_TAG_NAME,
              {
                value: this.options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
                ttl: this.options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL,
              }
            );

            this.dispatchEvent(
              new CustomEvent<PeerInfo>("peer", {
                detail: {
                  id: peerId,
                  multiaddrs,
                  protocols: [],
                },
              })
            );
          }
        }
      );
    }, 5 * 60 * 1000);

    this.intervals.set(peerId, interval);
  };

  constructor(components: PeerExchangeComponents, options: Options = {}) {
    super();
    this.components = components;
    this.peerExchange = new WakuPeerExchange(components);
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
      this.eventHandler
    );
  }

  /**
   * Remove event listener
   */
  stop(): void {
    if (!this.isStarted) return;
    log("Stopping peer exchange node discovery");
    this.isStarted = false;
    this.intervals.forEach((interval) => clearInterval(interval));
    this.components.peerStore.removeEventListener(
      "change:protocols",
      this.eventHandler
    );
  }

  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }
}

export function wakuPeerExchangeDiscovery(): (
  components: PeerExchangeComponents
) => PeerExchangeDiscovery {
  return (components: PeerExchangeComponents) =>
    new PeerExchangeDiscovery(components);
}
