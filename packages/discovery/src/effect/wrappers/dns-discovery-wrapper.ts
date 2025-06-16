/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
import { DnsClientLive } from "../services/dns/dns-client.js";
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
  private layer: any;
  private fiber: Fiber.RuntimeFiber<any, any> | null = null;
  private _started = false;
  private isRunning: Ref.Ref<boolean>;

  constructor(
    private components: DnsDiscoveryComponents,
    private options: DnsDiscOptions & {
      dnsClientLayer?: Layer.Layer<any, any, any>;
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
  async start(): Promise<void> {
    if (this._started) return;

    log.info("Starting Effect-based peer discovery via DNS");
    this._started = true;

    // Set running state
    Effect.runSync(Ref.set(this.isRunning, true));

    // Run initial discovery synchronously
    const self = this;
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* DnsDiscoveryService;

          // Get the ENR URLs to process
          const urls = Array.isArray(self.options.enrUrls)
            ? self.options.enrUrls
            : [self.options.enrUrls];

          // Process each URL
          for (const url of urls) {
            const peers = yield* service
              .discoverFromUrl(url)
              .pipe(
                Effect.orElseSucceed(() => [] as readonly DiscoveredPeer[])
              );

            // Handle each peer
            for (const peer of peers) {
              yield* self
                .handleDiscoveredPeer(peer)
                .pipe(Effect.orElseSucceed(() => undefined));
            }
          }
        }).pipe(Effect.provide(this.layer as any)) as any
      );
    } catch (error) {
      log.error("Initial discovery error:", error);
    }

    // Start continuous discovery in background
    const continuousEffect = Effect.gen(function* () {
      const service = yield* DnsDiscoveryService;

      yield* service.discover().pipe(
        Stream.tap((peer) => self.handleDiscoveredPeer(peer)),
        Stream.takeWhile(() => Effect.runSync(Ref.get(self.isRunning))),
        Stream.runDrain
      );
    }).pipe(Effect.provide(this.layer as any), Effect.fork);

    this.fiber = await Effect.runPromise(continuousEffect as any);
  }

  /**
   * Stop discovery
   */
  async stop(): Promise<void> {
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
  async findPeers(): Promise<void> {
    if (!this._started) {
      await this.start();
      return;
    }

    log.info("Triggering immediate DNS discovery");

    const self = this;
    const effect = Effect.gen(function* () {
      const service = yield* DnsDiscoveryService;

      // Discover from all URLs
      const peers = yield* Effect.forEach(
        self.options.enrUrls,
        (url) => service.discoverFromUrl(url),
        { concurrency: 3 }
      ).pipe(Effect.map((results) => results.flat()));

      // Handle each discovered peer
      yield* Effect.forEach(peers, (peer) => self.handleDiscoveredPeer(peer), {
        concurrency: "unbounded"
      });

      log.info(`Immediate discovery found ${peers.length} peers`);
    });

    await Effect.runPromise(
      effect.pipe(Effect.provide(this.layer as any)) as any
    );
  }

  /**
   * Handle a discovered peer
   */
  private handleDiscoveredPeer(peer: DiscoveredPeer): Effect.Effect<void> {
    const self = this;
    return Effect.gen(function* () {
      // Check if we should still be running
      const isRunning = yield* Ref.get(self.isRunning);
      if (!isRunning || !self._started) {
        return;
      }

      const { peerInfo, shardInfo } = peer;

      // Create tags
      const tags = createPeerTags(
        self.options.tagName || DEFAULT_BOOTSTRAP_TAG_NAME,
        self.options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
        self.options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL
      );

      // Update peer store
      const peerExists = yield* Effect.tryPromise(() =>
        self.components.peerStore.has(peerInfo.id)
      );

      if (peerExists) {
        // Check if we need to update
        const existingPeer = yield* Effect.tryPromise(() =>
          self.components.peerStore.get(peerInfo.id)
        );

        const hasTag = existingPeer.tags.has(
          self.options.tagName || DEFAULT_BOOTSTRAP_TAG_NAME
        );

        if (!hasTag) {
          yield* Effect.tryPromise(() =>
            self.components.peerStore.merge(peerInfo.id, { tags })
          );

          // Emit peer event only if still running
          const stillRunning = yield* Ref.get(self.isRunning);
          if (stillRunning && self._started) {
            yield* Effect.sync(() => {
              self.dispatchEvent(
                new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
              );
            });
          }
        }
      } else {
        // Save new peer
        yield* Effect.tryPromise(() =>
          self.components.peerStore.save(peerInfo.id, {
            tags,
            ...(shardInfo && {
              metadata: encodeShardInfo(shardInfo)
            })
          })
        );

        // Emit peer event only if still running
        const stillRunning = yield* Ref.get(self.isRunning);
        if (stillRunning && self._started) {
          yield* Effect.sync(() => {
            self.dispatchEvent(
              new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
            );
          });
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
  get [symbol](): true {
    return true;
  }

  get [Symbol.toStringTag](): string {
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
