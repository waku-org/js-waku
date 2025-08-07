import { TypedEventEmitter } from "@libp2p/interface";
import { peerDiscoverySymbol as symbol } from "@libp2p/interface";
import type {
  IdentifyResult,
  PeerDiscovery,
  PeerDiscoveryEvents,
  PeerId,
  PeerInfo
} from "@libp2p/interface";
import {
  type IPeerExchange,
  type Libp2pComponents,
  type Libp2pEventHandler
} from "@waku/interfaces";
import { encodeRelayShard, Logger } from "@waku/utils";

import {
  DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
  DEFAULT_PEER_EXCHANGE_TAG_NAME,
  DEFAULT_PEER_EXCHANGE_TAG_TTL,
  DEFAULT_PEER_EXCHANGE_TAG_VALUE,
  PeerExchangeCodec
} from "./constants.js";
import { PeerExchange } from "./peer_exchange.js";

const log = new Logger("peer-exchange-discovery");

interface PeerExchangeDiscoveryOptions {
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

export class PeerExchangeDiscovery
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery
{
  private readonly components: Libp2pComponents;
  private readonly peerExchange: IPeerExchange;
  private readonly options: PeerExchangeDiscoveryOptions;

  private isStarted: boolean = false;
  private queryingPeers: Set<string> = new Set();

  public constructor(
    components: Libp2pComponents,
    options: PeerExchangeDiscoveryOptions = {}
  ) {
    super();

    this.components = components;
    this.peerExchange = new PeerExchange(components);
    this.options = options;

    this.handleDiscoveredPeer = this.handleDiscoveredPeer.bind(this);
  }

  /**
   * Start Peer Exchange.
   * Subscribe to "peer:identify" events and handle them.
   */
  public start(): void {
    if (this.isStarted) {
      return;
    }

    log.info("Starting peer exchange node discovery, discovering peers");

    this.components.events.addEventListener(
      "peer:identify",
      this.handleDiscoveredPeer as Libp2pEventHandler<IdentifyResult>
    );
  }

  /**
   * Stop Peer Exchange.
   * Unsubscribe from "peer:identify" events.
   */
  public stop(): void {
    if (!this.isStarted) {
      return;
    }

    log.info("Stopping peer exchange node discovery");

    this.isStarted = false;
    this.queryingPeers.clear();

    this.components.events.removeEventListener(
      "peer:identify",
      this.handleDiscoveredPeer as Libp2pEventHandler<IdentifyResult>
    );
  }

  public get [symbol](): true {
    return true;
  }

  public get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }

  private async handleDiscoveredPeer(
    event: CustomEvent<IdentifyResult>
  ): Promise<void> {
    const { protocols, peerId } = event.detail;

    if (
      !protocols.includes(PeerExchangeCodec) ||
      this.queryingPeers.has(peerId.toString())
    ) {
      return;
    }

    try {
      this.queryingPeers.add(peerId.toString());
      await this.query(peerId);
    } catch (error) {
      log.error("Error querying peer", error);
    }

    this.queryingPeers.delete(peerId.toString());
  }

  private async query(peerId: PeerId): Promise<void> {
    const { error, peerInfos } = await this.peerExchange.query({
      numPeers: DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
      peerId
    });
    const peerIdStr = peerId.toString();

    if (error) {
      log.error(`Peer exchange query to ${peerIdStr} failed`, error);
      return;
    }

    for (const { ENR } of peerInfos) {
      if (!ENR) {
        log.warn(`No ENR in peerInfo object from ${peerIdStr}, skipping`);
        continue;
      }

      const { peerInfo, shardInfo } = ENR;

      if (!peerInfo) {
        log.warn(`No peerInfo in ENR from ${peerIdStr}, skipping`);
        continue;
      }

      await this.components.peerStore.merge(peerInfo.id, {
        tags: {
          [DEFAULT_PEER_EXCHANGE_TAG_NAME]: {
            value: this.options.tagValue ?? DEFAULT_PEER_EXCHANGE_TAG_VALUE,
            ttl: this.options.tagTTL ?? DEFAULT_PEER_EXCHANGE_TAG_TTL
          }
        },
        ...(shardInfo && {
          metadata: {
            shardInfo: encodeRelayShard(shardInfo)
          }
        }),
        ...(peerInfo.multiaddrs && {
          multiaddrs: peerInfo.multiaddrs
        })
      });

      log.info(`Discovered peer: ${peerInfo.id.toString()}`);

      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", {
          detail: {
            id: peerInfo.id,
            multiaddrs: peerInfo.multiaddrs
          }
        })
      );
    }
  }
}

export function wakuPeerExchangeDiscovery(): (
  components: Libp2pComponents
) => PeerExchangeDiscovery {
  return (components: Libp2pComponents) =>
    new PeerExchangeDiscovery(components);
}
