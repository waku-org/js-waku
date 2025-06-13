/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
import { Logger } from "@waku/utils";
import { Effect, Fiber, Ref, Runtime, Stream } from "effect";

import {
  DEFAULT_BOOTSTRAP_TAG_NAME,
  DEFAULT_BOOTSTRAP_TAG_TTL,
  DEFAULT_BOOTSTRAP_TAG_VALUE
} from "../../dns/constants.js";
import type {
  DiscoveredPeer,
  DnsDiscoveryConfig
} from "../services/common/types.js";
import { createPeerTags, encodeShardInfo } from "../services/common/utils.js";
import { DnsDiscoveryService } from "../services/dns/dns-service.js";

const log = new Logger("effect:peer-discovery-dns");

/**
 * Effect-based DNS discovery implementation that maintains compatibility
 * with libp2p's PeerDiscovery interface
 */
export class PeerDiscoveryDnsEffect
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery, DiscoveryTrigger
{
  private runtime: any;
  private fiber: Fiber.RuntimeFiber<any, any> | null = null;
  private _started = false;
  private isRunning: Ref.Ref<boolean>;

  constructor(
    private components: DnsDiscoveryComponents,
    private options: DnsDiscOptions
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

    // For now, use a default runtime
    // TODO: Create proper runtime with layers when build issues are resolved
    this.runtime = Runtime.defaultRuntime;

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

    // Create discovery effect
    const self = this;
    const discoveryEffect = Effect.gen(function* () {
      const service = yield* DnsDiscoveryService;
      yield* Ref.set(self.isRunning, true);

      // Start discovery stream
      yield* service.discover().pipe(
        Stream.tap((peer) => self.handleDiscoveredPeer(peer)),
        Stream.takeWhile(() =>
          Ref.get(self.isRunning).pipe(Runtime.runSync(self.runtime))
        ),
        Stream.runDrain
      );
    }).pipe(
      Effect.tapError((error) => Effect.logError("DNS discovery error", error)),
      Effect.fork
    );

    // Run effect
    this.fiber = await Runtime.runPromise(this.runtime)(discoveryEffect);
  }

  /**
   * Stop discovery
   */
  stop(): void {
    log.info("Stopping Effect-based DNS discovery");
    this._started = false;

    // Signal stop
    Runtime.runSync(this.runtime)(Ref.set(this.isRunning, false));

    // Interrupt fiber if running
    if (this.fiber) {
      Runtime.runPromise(this.runtime)(Fiber.interrupt(this.fiber)).catch(
        (error) => {
          log.error("Error interrupting discovery fiber", error);
        }
      );
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

    await Runtime.runPromise(this.runtime)(effect);
  }

  /**
   * Handle a discovered peer
   */
  private handleDiscoveredPeer(peer: DiscoveredPeer): Effect.Effect<void> {
    const self = this;
    return Effect.gen(function* () {
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

          // Emit peer event
          yield* Effect.sync(() => {
            self.dispatchEvent(
              new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
            );
          });
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

        // Emit peer event
        yield* Effect.sync(() => {
          self.dispatchEvent(
            new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
          );
        });
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
  return (components: DnsDiscoveryComponents) =>
    new PeerDiscoveryDnsEffect(components, {
      enrUrls,
      wantedNodeCapabilityCount
    });
}
