import { FetchHttpClient } from "@effect/platform";
import {
  PeerDiscovery,
  PeerDiscoveryEvents,
  TypedEventEmitter
} from "@libp2p/interface";
import { peerDiscoverySymbol as symbol } from "@libp2p/interface";
import type { PeerInfo } from "@libp2p/interface";
import type {
  DiscoveryTrigger,
  DnsDiscOptions,
  DnsDiscoveryComponents,
  NodeCapabilityCount
} from "@waku/interfaces";
import { DNS_DISCOVERY_TAG } from "@waku/interfaces";
import { Logger as WakuLogger } from "@waku/utils";
import { Effect, Fiber, Layer, Ref, Stream } from "effect";

import {
  DEFAULT_BOOTSTRAP_TAG_NAME,
  DEFAULT_BOOTSTRAP_TAG_TTL,
  DEFAULT_BOOTSTRAP_TAG_VALUE
} from "../../dns/constants.js";
import { createEnvironmentLoggerLayer } from "../services/common/logger.js";
import type {
  DiscoveredPeer,
  DnsDiscoveryConfig
} from "../services/common/types.js";
import { createPeerTags, encodeShardInfo } from "../services/common/utils.js";
import { DnsClient, DnsClientLive } from "../services/dns/dns-client.js";
import {
  DnsDiscoveryConfig as DnsDiscoveryConfigTag,
  DnsDiscoveryService,
  DnsDiscoveryServiceRaw
} from "../services/dns/dns-service.js";
import { EnrParserLive } from "../services/dns/enr-parser.js";

const log = new WakuLogger("effect:peer-discovery-dns");

/**
 * Effect-based DNS discovery implementation that maintains compatibility
 * with libp2p's PeerDiscovery interface
 */
export class PeerDiscoveryDnsEffect
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery, DiscoveryTrigger
{
  private layer: Layer.Layer<DnsDiscoveryService, never, never>;
  private fiber: Fiber.RuntimeFiber<void, never> | null = null;
  private _started = false;
  private isRunning: Ref.Ref<boolean>;

  public constructor(
    private components: DnsDiscoveryComponents,
    private options: DnsDiscOptions & {
      dnsClientLayer?: Layer.Layer<DnsClient, never, never>;
    }
  ) {
    super();

    // Create configuration
    const config: DnsDiscoveryConfig = {
      enrUrls: Array.isArray(options.enrUrls)
        ? options.enrUrls
        : [options.enrUrls],
      wantedNodeCapabilityCount: options.wantedNodeCapabilityCount || {},
      tagName: options.tagName || DEFAULT_BOOTSTRAP_TAG_NAME,
      tagValue: options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
      tagTTL: options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL
    };

    // Create layer stack for DNS discovery
    // Build the complete layer by providing all dependencies
    // Allow injection of custom DNS client for testing
    const dnsClientLayer = options.dnsClientLayer || DnsClientLive;

    this.layer = DnsDiscoveryServiceRaw.pipe(
      Layer.provide(dnsClientLayer),
      Layer.provide(EnrParserLive),
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(createEnvironmentLoggerLayer("dns-discovery")),
      Layer.provide(Layer.succeed(DnsDiscoveryConfigTag, config))
    );

    // Initialize running state
    this.isRunning = Effect.runSync(Ref.make(false));

    log.info("Created Effect-based DNS discovery with URLs:", config.enrUrls);
  }

  /**
   * Start discovery process
   */
  public async start(): Promise<void> {
    if (this._started) return;

    log.info("Starting Effect-based peer discovery via DNS");
    this._started = true;

    // Set running state
    Effect.runSync(Ref.set(this.isRunning, true));

    // Run initial discovery synchronously
    try {
      const peerHandler = this.handleDiscoveredPeer.bind(this);
      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DnsDiscoveryService;

          // Get the ENR URLs to process
          const urls = Array.isArray(options.enrUrls)
            ? options.enrUrls
            : [options.enrUrls];

          // Process each URL
          for (const url of urls) {
            const peers = yield* service
              .discoverFromUrl(url)
              .pipe(
                Effect.orElseSucceed(() => [] as readonly DiscoveredPeer[])
              );

            // Handle each peer
            for (const peer of peers) {
              yield* peerHandler(peer).pipe(
                Effect.orElseSucceed(() => undefined)
              );
            }
          }
        }).pipe(Effect.provide(this.layer))
      );
    } catch (error) {
      log.error("Initial discovery error:", error);
    }

    // Start continuous discovery in background
    const peerHandler = this.handleDiscoveredPeer.bind(this);
    const isRunningRef = this.isRunning;
    const continuousEffect = Effect.gen(function* () {
      const service = yield* DnsDiscoveryService;

      yield* service.discover().pipe(
        Stream.tap((peer) => peerHandler(peer)),
        Stream.takeWhile(() => Effect.runSync(Ref.get(isRunningRef))),
        Stream.runDrain
      );
    }).pipe(Effect.provide(this.layer), Effect.fork);

    this.fiber = await Effect.runPromise(continuousEffect);
  }

  /**
   * Stop discovery
   */
  public async stop(): Promise<void> {
    log.info("Stopping Effect-based DNS discovery");
    this._started = false;

    // Signal stop first
    Effect.runSync(Ref.set(this.isRunning, false));

    // Interrupt fiber if running and wait for completion
    if (this.fiber) {
      try {
        // Wait for fiber interruption to complete
        await Effect.runPromise(Fiber.interrupt(this.fiber));
        // Small delay to ensure all effects are cleaned up
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch (error) {
        log.error("Error interrupting discovery fiber", error);
      }
      this.fiber = null;
    }
  }

  /**
   * Trigger immediate discovery
   */
  public async findPeers(): Promise<void> {
    if (!this._started) {
      await this.start();
      return;
    }

    log.info("Triggering immediate DNS discovery");

    const peerHandler = this.handleDiscoveredPeer.bind(this);
    const enrUrls = this.options.enrUrls;
    const effect = Effect.gen(function* () {
      const service = yield* DnsDiscoveryService;

      // Discover from all URLs
      const peers = yield* Effect.forEach(
        enrUrls,
        (url) => service.discoverFromUrl(url),
        { concurrency: 3 }
      ).pipe(Effect.map((results) => results.flat()));

      // Handle each discovered peer
      yield* Effect.forEach(peers, (peer) => peerHandler(peer), {
        concurrency: "unbounded"
      });

      log.info(`Immediate discovery found ${peers.length} peers`);
    });

    await Effect.runPromise(effect.pipe(Effect.provide(this.layer)));
  }

  /**
   * Handle a discovered peer
   */
  private handleDiscoveredPeer(peer: DiscoveredPeer): Effect.Effect<void> {
    const components = this.components;
    const options = this.options;
    const isRunningRef = this.isRunning;
    const isStarted = (): boolean => this._started;
    const emitEvent = (peerInfo: PeerInfo): void => {
      this.dispatchEvent(
        new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
      );
    };

    return Effect.gen(function* () {
      // Check if we should still be running
      const isRunning = yield* Ref.get(isRunningRef);
      if (!isRunning || !isStarted()) {
        return;
      }

      const { peerInfo, shardInfo } = peer;

      // Create tags
      const tags = createPeerTags(
        options.tagName || DEFAULT_BOOTSTRAP_TAG_NAME,
        options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
        options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL
      );

      // Update peer store
      const peerExists = yield* Effect.tryPromise(() =>
        components.peerStore.has(peerInfo.id)
      );

      if (peerExists) {
        // Check if we need to update
        const existingPeer = yield* Effect.tryPromise(() =>
          components.peerStore.get(peerInfo.id)
        );

        const hasTag = existingPeer.tags.has(
          options.tagName || DEFAULT_BOOTSTRAP_TAG_NAME
        );

        if (!hasTag) {
          yield* Effect.tryPromise(() =>
            components.peerStore.merge(peerInfo.id, { tags })
          );

          // Emit peer event only if still running
          const stillRunning = yield* Ref.get(isRunningRef);
          if (stillRunning && isStarted()) {
            yield* Effect.sync(() => emitEvent(peerInfo));
          }
        }
      } else {
        // Save new peer
        yield* Effect.tryPromise(() =>
          components.peerStore.save(peerInfo.id, {
            tags,
            ...(shardInfo && {
              metadata: encodeShardInfo(shardInfo)
            })
          })
        );

        // Emit peer event only if still running
        const stillRunning = yield* Ref.get(isRunningRef);
        if (stillRunning && isStarted()) {
          yield* Effect.sync(() => emitEvent(peerInfo));
        }
      }
    }).pipe(
      Effect.tapError((error) =>
        Effect.logWarning(
          `Failed to handle discovered peer ${peer.peerInfo.id}`,
          error
        )
      ),
      Effect.orElseSucceed(() => void 0)
    );
  }

  // Required libp2p PeerDiscovery properties
  public get [symbol](): true {
    return true;
  }

  public get [Symbol.toStringTag](): string {
    return DNS_DISCOVERY_TAG;
  }
}

/**
 * Factory function that maintains compatibility with existing API
 */
export function wakuDnsDiscovery(
  enrUrls: string[],
  wantedNodeCapabilityCount: Partial<NodeCapabilityCount> = {}
): (components: DnsDiscoveryComponents) => PeerDiscovery {
  return (components: DnsDiscoveryComponents) => {
    return new PeerDiscoveryDnsEffect(components, {
      enrUrls,
      wantedNodeCapabilityCount
    });
  };
}
