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
import { Effect, Layer, Ref } from "effect";

import {
  CacheService,
  CacheServiceLive,
  InMemoryStorageBackend,
  LocalCacheConfig as LocalCacheConfigTag,
  LocalStorageBackend
} from "../services/cache/cache-service.js";
import { createEnvironmentLoggerLayer } from "../services/common/logger.js";
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
  private layer: Layer.Layer<CacheService, never, never>;
  private isStarted = false;
  private isRunning: Ref.Ref<boolean>;

  public constructor(
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

    this.layer = Layer.mergeAll(
      CacheServiceLive,
      Layer.succeed(LocalCacheConfigTag, config),
      storageLayer,
      createEnvironmentLoggerLayer("local-cache")
    );

    // Initialize running state
    this.isRunning = Effect.runSync(Ref.make(false));

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
    await Effect.runPromise(Ref.set(this.isRunning, true));

    // Listen for new peers
    this.components.events.addEventListener(
      "peer:identify",
      this.handleNewPeers
    );

    // Load and emit cached peers
    const components = this.components;
    const options = this.options;
    const emitEvent = (peerInfo: PeerInfo): void => {
      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", {
          detail: peerInfo
        })
      );
    };
    const effect = Effect.gen(function* () {
      const cache = yield* CacheService;
      const peers = yield* cache.getAll();

      log.info(`Loading ${peers.length} peers from cache`);

      // Emit cached peers
      for (const discoveredPeer of peers) {
        const { peerInfo } = discoveredPeer;

        // Check if peer already exists
        const hasPeer = yield* Effect.tryPromise(() =>
          components.peerStore.has(peerInfo.id)
        );

        if (!hasPeer) {
          // Save to peer store
          const tags = createPeerTags(
            options?.tagName ?? DEFAULT_LOCAL_TAG_NAME,
            options?.tagValue ?? DEFAULT_LOCAL_TAG_VALUE,
            options?.tagTTL ?? DEFAULT_LOCAL_TAG_TTL
          );

          yield* Effect.tryPromise(() =>
            components.peerStore.save(peerInfo.id, {
              multiaddrs: peerInfo.multiaddrs,
              tags
            })
          );

          // Emit peer event
          yield* Effect.sync(() => emitEvent(peerInfo));
        }
      }

      log.info(`Discovered ${peers.length} peers from cache`);
    }).pipe(
      Effect.tapError((error) =>
        Effect.logError("Failed to load peers from cache", error)
      ),
      Effect.orElseSucceed(() => void 0)
    );

    await Effect.runPromise(effect.pipe(Effect.provide(this.layer)));
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
    Effect.runSync(Ref.set(this.isRunning, false));
  }

  /**
   * Handle newly identified peers
   */
  public handleNewPeers = (event: CustomEvent<IdentifyResult>): void => {
    const { peerId, listenAddrs } = event.detail;

    // Get websocket multiaddr
    const websocketMultiaddr = getWsMultiaddrFromMultiaddrs(listenAddrs);

    // Store peer in cache
    const isRunningRef = this.isRunning;
    const effect = Effect.gen(function* () {
      const cache = yield* CacheService;
      const running = yield* Ref.get(isRunningRef);

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

    Effect.runPromise(effect.pipe(Effect.provide(this.layer))).catch(
      (error) => {
        log.error("Error handling new peer", error);
      }
    );
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
