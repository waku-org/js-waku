/* eslint-disable @typescript-eslint/explicit-function-return-type */

import type { IEnr } from "@waku/interfaces";
import { Context, Effect, Layer, Schedule, Stream } from "effect";

import { NetworkTimeoutError } from "../common/errors.js";
import type {
  DiscoveredPeer,
  DnsDiscoveryConfig as IDnsDiscoveryConfig,
  DnsDiscoveryService as IDnsDiscoveryService
} from "../common/types.js";
import { enrToDiscoveredPeer, filterByCapabilities } from "../common/utils.js";

import { DnsClient, DnsClientLive } from "./dns-client.js";
import { EnrParser, EnrParserLive } from "./enr-parser.js";

/**
 * DNS Discovery Service tag
 */
export const DnsDiscoveryService = Context.GenericTag<IDnsDiscoveryService>(
  "DnsDiscoveryService"
);

/**
 * DNS Discovery Config tag
 */
export const DnsDiscoveryConfig =
  Context.GenericTag<IDnsDiscoveryConfig>("DnsDiscoveryConfig");

/**
 * DNS Discovery Service implementation (raw version without composed dependencies)
 */
export const DnsDiscoveryServiceRaw = Layer.effect(
  DnsDiscoveryService,
  Effect.gen(function* () {
    const config = yield* DnsDiscoveryConfig;
    const dnsClient = yield* DnsClient;
    const enrParser = yield* EnrParser;

    const discoverFromUrl = (enrUrl: string) =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Discovering peers from ${enrUrl}`);

        // Parse ENR tree URL
        const treeUrl = yield* enrParser.parseTreeUrl(enrUrl);

        // Fetch DNS records with retry
        const records = yield* dnsClient
          .fetchRecords(treeUrl.domain, treeUrl.publicKey)
          .pipe(
            Effect.timeout("30 seconds"),
            Effect.mapError(
              () =>
                new NetworkTimeoutError({
                  operation: `DNS lookup for ${treeUrl.domain}`,
                  timeoutMs: 30000
                })
            ),
            Effect.retry(
              Schedule.exponential("1 second", 2).pipe(
                Schedule.jittered,
                Schedule.upTo("10 seconds")
              )
            )
          );

        // Parse ENR records
        const enrs = yield* Effect.forEach(
          records,
          (record) =>
            enrParser.parseEnr(record).pipe(Effect.orElseSucceed(() => null)),
          {
            concurrency: 10
          }
        ).pipe(
          Effect.map((results) =>
            results.filter((enr): enr is IEnr => enr !== null)
          )
        );

        // Filter by requirements
        const filtered = yield* filterByCapabilities(
          enrs,
          config.wantedNodeCapabilityCount || {}
        );

        // Convert to DiscoveredPeer
        const peers = yield* Effect.forEach(
          filtered,
          (enr) =>
            enrToDiscoveredPeer(enr, {
              _tag: "dns",
              domain: treeUrl.domain
            }).pipe(Effect.orElseSucceed(() => null)),
          {
            concurrency: "unbounded"
          }
        ).pipe(
          Effect.map((results) =>
            results.filter((peer): peer is DiscoveredPeer => peer !== null)
          )
        );

        yield* Effect.logInfo(
          `Discovered ${peers.length} peers from ${enrUrl}`
        );

        return peers;
      }).pipe(
        Effect.tapError((error) =>
          Effect.logWarning(`Failed to discover from ${enrUrl}`, error)
        ),
        Effect.orElseSucceed(() => [] as readonly DiscoveredPeer[])
      );

    const discoverAll = () =>
      Effect.gen(function* () {
        const results = yield* Effect.forEach(config.enrUrls, discoverFromUrl, {
          concurrency: 3
        });

        return results.flat();
      });

    const discover = () =>
      Stream.repeatEffect(discoverAll()).pipe(
        Stream.schedule(Schedule.spaced("5 minutes")),
        Stream.mapConcat((peers) => peers),
        Stream.tap((peer) =>
          Effect.logDebug(`Discovered peer ${peer.peerInfo.id}`)
        )
      );

    const stop = () => Effect.logInfo("Stopping DNS discovery service");

    return {
      discover,
      stop,
      discoverFromUrl,
      filterPeers: (
        peers: readonly IEnr[],
        requirements: Partial<import("@waku/interfaces").NodeCapabilityCount>
      ) => filterByCapabilities(peers, requirements)
    } satisfies IDnsDiscoveryService;
  })
);

/**
 * DNS Discovery Service implementation (with pre-composed dependencies for convenience)
 */
export const DnsDiscoveryServiceLive = DnsDiscoveryServiceRaw.pipe(
  Layer.provide(DnsClientLive),
  Layer.provide(EnrParserLive)
);
