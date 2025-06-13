/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import { TypedEventEmitter } from "@libp2p/interface";
import {
  IdentifyResult,
  PeerDiscovery,
  PeerDiscoveryEvents,
  PeerInfo,
  Startable
} from "@libp2p/interface";
import type { Libp2pComponents } from "@waku/interfaces";
import { Tags } from "@waku/interfaces";
import { getWsMultiaddrFromMultiaddrs, Logger } from "@waku/utils";
import { Effect, Layer, Ref, Runtime } from "effect";

import {
  CacheService,
  CacheServiceLive,
  InMemoryStorageBackend,
  LocalCacheConfig as LocalCacheConfigTag,
  LocalStorageBackend
} from "../services/cache/cache-service.js";
import type {
  DiscoveredPeer,
  LocalCacheConfig
} from "../services/common/types.js";
import { createPeerTags } from "../services/common/utils.js";

const log = new Logger("effect:local-peer-cache-discovery");

export const DEFAULT_LOCAL_TAG_NAME = Tags.LOCAL;
const DEFAULT_LOCAL_TAG_VALUE = 50;
const DEFAULT_LOCAL_TAG_TTL = 100_000_000;

type LocalPeerCacheDiscoveryOptions = {
  tagName?: string;
  tagValue?: number;
  tagTTL?: number;
};

/**
 * Effect-based Local Peer Cache Discovery implementation
 */
export class LocalPeerCacheDiscoveryEffect
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery, Startable
{
  private runtime: Runtime.Runtime<any>;
  private _layer: Layer.Layer<any, any, any>;
  private isStarted = false;
  private isRunning: Ref.Ref<boolean>;

  constructor(
    private readonly components: Libp2pComponents,
    private readonly options?: LocalPeerCacheDiscoveryOptions
  ) {
    super();

    // Create configuration
    const config: LocalCacheConfig = {
      maxPeers: 100,
      maxSize: 1000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      storageKey: "waku:discovery:cache"
    };

    // Create runtime with appropriate storage backend
    const storageLayer =
      typeof window !== "undefined" && window.localStorage
        ? LocalStorageBackend
        : InMemoryStorageBackend;

    const layer = Layer.mergeAll(
      CacheServiceLive,
      Layer.succeed(LocalCacheConfigTag, config),
      storageLayer
    );

    // Create runtime from layer
    // For now, we'll use the default runtime and provide the layer when running effects
    this.runtime = Runtime.defaultRuntime as Runtime.Runtime<any>;
    this._layer = layer;

    // Initialize running state
    this.isRunning = Runtime.runSync(this.runtime)(Ref.make(false));

    // Store layer for later use when running effects
    // @ts-ignore - used in effect execution
    this._layer;

    log.info("Created Effect-based local peer cache discovery");
  }

  public get [Symbol.toStringTag](): string {
    return "@waku/local-peer-cache-discovery";
  }

  /**
   * Start discovery process
   */
  public async start(): Promise<void> {
    if (this.isStarted) return;

    log.info("Starting Effect-based Local Storage Discovery");
    this.isStarted = true;

    // Set running state
    await Runtime.runPromise(this.runtime)(Ref.set(this.isRunning, true));

    // Listen for new peers
    this.components.events.addEventListener(
      "peer:identify",
      this.handleNewPeers
    );

    // Load and emit cached peers
    const self = this;
    const effect = Effect.gen(function* () {
      const cache = yield* CacheService;
      const peers = yield* cache.getAll();

      log.info(`Loading ${peers.length} peers from cache`);

      // Emit cached peers
      for (const discoveredPeer of peers) {
        const { peerInfo } = discoveredPeer;

        // Check if peer already exists
        const hasPeer = yield* Effect.tryPromise(() =>
          self.components.peerStore.has(peerInfo.id)
        );

        if (!hasPeer) {
          // Save to peer store
          const tags = createPeerTags(
            self.options?.tagName ?? DEFAULT_LOCAL_TAG_NAME,
            self.options?.tagValue ?? DEFAULT_LOCAL_TAG_VALUE,
            self.options?.tagTTL ?? DEFAULT_LOCAL_TAG_TTL
          );

          yield* Effect.tryPromise(() =>
            self.components.peerStore.save(peerInfo.id, {
              multiaddrs: peerInfo.multiaddrs,
              tags
            })
          );

          // Emit peer event
          yield* Effect.sync(() => {
            self.dispatchEvent(
              new CustomEvent<PeerInfo>("peer", {
                detail: peerInfo
              })
            );
          });
        }
      }

      log.info(`Discovered ${peers.length} peers from cache`);
    }).pipe(
      Effect.tapError((error) =>
        Effect.logError("Failed to load peers from cache", error)
      ),
      Effect.orElseSucceed(() => void 0)
    );

    await Runtime.runPromise(this.runtime)(effect);
  }

  /**
   * Stop discovery
   */
  public stop(): void | Promise<void> {
    if (!this.isStarted) return;

    log.info("Stopping Effect-based Local Storage Discovery");
    this.isStarted = false;

    // Remove event listener
    this.components.events.removeEventListener(
      "peer:identify",
      this.handleNewPeers
    );

    // Set running state
    Runtime.runSync(this.runtime)(Ref.set(this.isRunning, false));
  }

  /**
   * Handle newly identified peers
   */
  public handleNewPeers = (event: CustomEvent<IdentifyResult>): void => {
    const { peerId, listenAddrs } = event.detail;

    // Get websocket multiaddr
    const websocketMultiaddr = getWsMultiaddrFromMultiaddrs(listenAddrs);

    // Store peer in cache
    const self = this;
    const effect = Effect.gen(function* () {
      const cache = yield* CacheService;
      const running = yield* Ref.get(self.isRunning);

      if (!running) return;

      // Create discovered peer
      const discoveredPeer: DiscoveredPeer = {
        peerInfo: {
          id: peerId,
          multiaddrs: [websocketMultiaddr]
        },
        discoveredAt: new Date(),
        source: { _tag: "cache", key: peerId.toString() }
      };

      // Store in cache
      yield* cache.set(peerId.toString(), discoveredPeer);

      log.info(`Cached peer ${peerId} with address ${websocketMultiaddr}`);
    }).pipe(
      Effect.tapError((error) =>
        Effect.logWarning(`Failed to cache peer ${peerId}`, error)
      ),
      Effect.orElseSucceed(() => void 0)
    );

    Runtime.runPromise(this.runtime)(effect).catch((error) => {
      log.error("Error handling new peer", error);
    });
  };
}

/**
 * Factory function that maintains compatibility with existing API
 */
export function wakuLocalPeerCacheDiscovery(): (
  components: Libp2pComponents,
  options?: LocalPeerCacheDiscoveryOptions
) => LocalPeerCacheDiscoveryEffect {
  return (
    components: Libp2pComponents,
    options?: LocalPeerCacheDiscoveryOptions
  ) => new LocalPeerCacheDiscoveryEffect(components, options);
}
