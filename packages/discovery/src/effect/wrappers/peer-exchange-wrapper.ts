/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { TypedEventEmitter } from "@libp2p/interface";
import { peerDiscoverySymbol as symbol } from "@libp2p/interface";
import type {
  IdentifyResult,
  PeerDiscovery,
  PeerDiscoveryEvents,
  PeerInfo
} from "@libp2p/interface";
import type {
  Libp2pComponents,
  PubsubTopic,
  ShardInfo
} from "@waku/interfaces";
import { Tags } from "@waku/interfaces";
import { decodeRelayShard, Logger } from "@waku/utils";
import { Effect, Fiber, Layer, Ref, Runtime, Stream } from "effect";

import { PeerExchangeCodec } from "../../peer-exchange/waku_peer_exchange.js";
import type {
  DiscoveredPeer,
  PeerExchangeConfig
} from "../services/common/types.js";
import { createPeerTags, encodeShardInfo } from "../services/common/utils.js";
import { Libp2pComponents as LibP2pComponentsTag } from "../services/peer-exchange/peer-exchange-protocol.js";
import {
  createPeerExchangeLayer,
  PeerExchangeService
} from "../services/peer-exchange/peer-exchange-service.js";

const log = new Logger("effect:peer-exchange-discovery");

const DEFAULT_PEER_EXCHANGE_REQUEST_NODES = 10;
const DEFAULT_PEER_EXCHANGE_QUERY_INTERVAL_MS = 10 * 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_PEER_EXCHANGE_TAG_NAME = Tags.PEER_EXCHANGE;
const DEFAULT_PEER_EXCHANGE_TAG_VALUE = 50;
const DEFAULT_PEER_EXCHANGE_TAG_TTL = 100_000_000;

export interface Options {
  tagName?: string;
  tagValue?: number;
  tagTTL?: number;
  queryInterval?: number;
  maxRetries?: number;
}

interface CustomDiscoveryEvent extends PeerDiscoveryEvents {
  "waku:peer-exchange:started": CustomEvent<boolean>;
}

/**
 * Effect-based Peer Exchange Discovery implementation
 */
export class PeerExchangeDiscoveryEffect
  extends TypedEventEmitter<CustomDiscoveryEvent>
  implements PeerDiscovery
{
  private runtime: Runtime.Runtime<any>;
  private _layer: Layer.Layer<any, any, any>;
  private fiber: Fiber.RuntimeFiber<void, any> | null = null;
  private isStarted = false;
  private isRunning: Ref.Ref<boolean>;

  constructor(
    private components: Libp2pComponents,
    pubsubTopics: PubsubTopic[],
    private options: Options = {}
  ) {
    super();

    // Create configuration
    const config: PeerExchangeConfig = {
      numPeersToRequest: DEFAULT_PEER_EXCHANGE_REQUEST_NODES,
      queryInterval:
        options.queryInterval || DEFAULT_PEER_EXCHANGE_QUERY_INTERVAL_MS,
      maxRetries: options.maxRetries || DEFAULT_MAX_RETRIES,
      tagName: options.tagName || DEFAULT_PEER_EXCHANGE_TAG_NAME,
      tagValue: options.tagValue ?? DEFAULT_PEER_EXCHANGE_TAG_VALUE,
      tagTTL: options.tagTTL ?? DEFAULT_PEER_EXCHANGE_TAG_TTL
    };

    // Create runtime with services
    const layer = Layer.mergeAll(
      createPeerExchangeLayer(pubsubTopics, config),
      Layer.succeed(LibP2pComponentsTag, components)
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

    log.info("Created Effect-based peer exchange discovery");
  }

  /**
   * Start discovery process
   */
  public start(): void {
    if (this.isStarted) return;

    log.info("Starting Effect-based peer exchange discovery");
    this.isStarted = true;

    this.dispatchEvent(
      new CustomEvent("waku:peer-exchange:started", { detail: true })
    );

    // Listen for peers that support peer exchange
    this.components.events.addEventListener(
      "peer:identify",
      this.handleDiscoveredPeer
    );

    // Start discovery effect
    const self = this;
    const discoveryEffect = Effect.gen(function* () {
      const service = yield* PeerExchangeService;
      yield* Ref.set(self.isRunning, true);

      // Start discovery stream
      yield* service.discover().pipe(
        Stream.tap((peer) => self.handleDiscoveredPeerFromExchange(peer)),
        Stream.takeWhile(() =>
          Ref.get(self.isRunning).pipe(Runtime.runSync(self.runtime))
        ),
        Stream.runDrain
      );
    }).pipe(
      Effect.tapError((error) =>
        Effect.logError("Peer exchange discovery error", error)
      ),
      Effect.fork
    );

    // Run effect
    Runtime.runPromise(this.runtime)(discoveryEffect).then((fiber) => {
      this.fiber = fiber;
    });
  }

  /**
   * Stop discovery
   */
  public stop(): void {
    if (!this.isStarted) return;

    log.info("Stopping Effect-based peer exchange discovery");
    this.isStarted = false;

    // Remove event listener
    this.components.events.removeEventListener(
      "peer:identify",
      this.handleDiscoveredPeer
    );

    // Signal stop
    Runtime.runSync(this.runtime)(Ref.set(this.isRunning, false));

    // Stop service and interrupt fiber
    if (this.fiber) {
      const self = this;
      Runtime.runPromise(this.runtime)(
        Effect.gen(function* () {
          const service = yield* PeerExchangeService;
          yield* service.stop();
          yield* Fiber.interrupt(self.fiber!);
        })
      ).catch((error) => {
        log.error("Error stopping peer exchange discovery", error);
      });
      this.fiber = null;
    }
  }

  /**
   * Handle identified peer
   */
  private handleDiscoveredPeer = (event: CustomEvent<IdentifyResult>): void => {
    const { protocols, peerId } = event.detail;

    if (!protocols.includes(PeerExchangeCodec)) {
      return;
    }

    // Start querying this peer
    const effect = Effect.gen(function* () {
      const service = yield* PeerExchangeService;
      yield* (service as any).handlePeerExchangePeer(peerId);
    });

    Runtime.runPromise(this.runtime)(effect).catch((error) => {
      log.error(`Failed to handle peer exchange peer ${peerId}`, error);
    });
  };

  /**
   * Handle peer discovered through exchange
   */
  private handleDiscoveredPeerFromExchange(
    peer: DiscoveredPeer
  ): Effect.Effect<void> {
    const self = this;
    return Effect.gen(function* () {
      const { peerInfo, shardInfo } = peer;
      const { id: peerId } = peerInfo;

      // Check if peer already exists
      const hasPeer = yield* Effect.tryPromise(() =>
        self.components.peerStore.has(peerId)
      );

      if (hasPeer) {
        // Check for differences
        const { hasMultiaddrDiff, hasShardDiff } =
          yield* self.checkPeerInfoDiff(peerInfo, shardInfo);

        if (hasMultiaddrDiff || hasShardDiff) {
          log.info(`Peer ${peerId} has updates, updating store`);

          if (hasMultiaddrDiff) {
            yield* Effect.tryPromise(() =>
              self.components.peerStore.patch(peerId, {
                multiaddrs: peerInfo.multiaddrs
              })
            );
          }

          if (hasShardDiff && shardInfo) {
            yield* Effect.tryPromise(() =>
              self.components.peerStore.merge(peerId, {
                metadata: encodeShardInfo(shardInfo)
              })
            );
          }

          // Emit peer event
          yield* Effect.sync(() => {
            self.dispatchEvent(
              new CustomEvent<PeerInfo>("peer", { detail: peerInfo })
            );
          });
        }
      } else {
        // Save new peer
        const tags = createPeerTags(
          self.options.tagName || DEFAULT_PEER_EXCHANGE_TAG_NAME,
          self.options.tagValue ?? DEFAULT_PEER_EXCHANGE_TAG_VALUE,
          self.options.tagTTL ?? DEFAULT_PEER_EXCHANGE_TAG_TTL
        );

        yield* Effect.tryPromise(() =>
          self.components.peerStore.save(peerId, {
            tags,
            ...(shardInfo && {
              metadata: encodeShardInfo(shardInfo)
            }),
            ...(peerInfo.multiaddrs && {
              multiaddrs: peerInfo.multiaddrs
            })
          })
        );

        log.info(`Discovered new peer: ${peerId}`);

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

  /**
   * Check for differences in peer info
   */
  private checkPeerInfoDiff(peerInfo: PeerInfo, shardInfo?: ShardInfo) {
    const self = this;
    return Effect.tryPromise({
      try: async () => {
        const { id: peerId } = peerInfo;
        const peer = await self.components.peerStore.get(peerId);

        const existingMultiaddrs = peer.addresses.map((a) =>
          a.multiaddr.toString()
        );
        const newMultiaddrs = peerInfo.multiaddrs.map((ma) => ma.toString());
        const hasMultiaddrDiff = existingMultiaddrs.some(
          (ma) => !newMultiaddrs.includes(ma)
        );

        let hasShardDiff = false;
        const existingShardInfoBytes = peer.metadata.get("shardInfo");
        if (existingShardInfoBytes) {
          const existingShardInfo = decodeRelayShard(existingShardInfoBytes);
          if (existingShardInfo && shardInfo) {
            hasShardDiff =
              existingShardInfo.clusterId !== shardInfo.clusterId ||
              existingShardInfo.shards.some(
                (shard) => !shardInfo.shards.includes(shard)
              );
          }
        }

        return { hasMultiaddrDiff, hasShardDiff };
      },
      catch: () => ({ hasMultiaddrDiff: false, hasShardDiff: false })
    });
  }

  // Required libp2p PeerDiscovery properties
  public get [symbol](): true {
    return true;
  }

  public get [Symbol.toStringTag](): string {
    return "@waku/peer-exchange";
  }
}

/**
 * Factory function that maintains compatibility with existing API
 */
export function wakuPeerExchangeDiscovery(
  pubsubTopics: PubsubTopic[]
): (components: Libp2pComponents) => PeerDiscovery {
  return (components: Libp2pComponents) =>
    new PeerExchangeDiscoveryEffect(components, pubsubTopics);
}
