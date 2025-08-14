import { TypedEventEmitter } from "@libp2p/interface";
import {
  IdentifyResult,
  PeerDiscovery,
  PeerDiscoveryEvents,
  PeerInfo,
  Startable
} from "@libp2p/interface";
import { peerIdFromString } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import type {
  Libp2pComponents,
  PartialPeerInfo,
  PeerCache,
  PeerCacheDiscoveryOptions
} from "@waku/interfaces";
import { Logger } from "@waku/utils";

import {
  DEFAULT_PEER_CACHE_TAG_NAME,
  DEFAULT_PEER_CACHE_TAG_VALUE
} from "./constants.js";
import { defaultCache } from "./utils.js";

const log = new Logger("peer-cache");

export class PeerCacheDiscovery
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery, Startable
{
  private isStarted: boolean = false;
  private readonly cache: PeerCache;

  public constructor(
    private readonly components: Libp2pComponents,
    options?: Partial<PeerCacheDiscoveryOptions>
  ) {
    super();
    this.cache = options?.cache ?? defaultCache();
  }

  public get [Symbol.toStringTag](): string {
    return `@waku/${DEFAULT_PEER_CACHE_TAG_NAME}`;
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    log.info("Starting Peer Cache Discovery");

    this.components.events.addEventListener(
      "peer:identify",
      this.handleDiscoveredPeer
    );

    await this.discoverPeers();

    this.isStarted = true;
  }

  public stop(): void | Promise<void> {
    if (!this.isStarted) {
      return;
    }

    log.info("Stopping Peer Cache Discovery");

    this.components.events.removeEventListener(
      "peer:identify",
      this.handleDiscoveredPeer
    );

    this.isStarted = false;
  }

  private handleDiscoveredPeer = (event: CustomEvent<IdentifyResult>): void => {
    const { peerId, listenAddrs } = event.detail;
    const multiaddrs = listenAddrs.map((addr) => addr.toString());

    const peerIdStr = peerId.toString();
    const knownPeers = this.readPeerInfoFromCache();
    const peerIndex = knownPeers.findIndex((p) => p.id === peerIdStr);

    if (peerIndex !== -1) {
      knownPeers[peerIndex].multiaddrs = multiaddrs;
    } else {
      knownPeers.push({
        id: peerIdStr,
        multiaddrs
      });
    }

    this.writePeerInfoToCache(knownPeers);
  };

  private async discoverPeers(): Promise<void> {
    const knownPeers = this.readPeerInfoFromCache();

    for (const peer of knownPeers) {
      const peerId = peerIdFromString(peer.id);
      const multiaddrs = peer.multiaddrs.map((addr) => multiaddr(addr));

      if (await this.components.peerStore.has(peerId)) {
        continue;
      }

      await this.components.peerStore.save(peerId, {
        multiaddrs,
        tags: {
          [DEFAULT_PEER_CACHE_TAG_NAME]: {
            value: DEFAULT_PEER_CACHE_TAG_VALUE
          }
        }
      });

      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", {
          detail: {
            id: peerId,
            multiaddrs
          }
        })
      );
    }
  }

  private readPeerInfoFromCache(): PartialPeerInfo[] {
    try {
      return this.cache.get();
    } catch (error) {
      log.error("Error parsing peers from cache:", error);
      return [];
    }
  }

  private writePeerInfoToCache(peers: PartialPeerInfo[]): void {
    try {
      this.cache.set(peers);
    } catch (error) {
      log.error("Error saving peers to cache:", error);
    }
  }
}

export function wakuPeerCacheDiscovery(
  options: Partial<PeerCacheDiscoveryOptions> = {}
): (components: Libp2pComponents) => PeerCacheDiscovery {
  return (components: Libp2pComponents) =>
    new PeerCacheDiscovery(components, options);
}
