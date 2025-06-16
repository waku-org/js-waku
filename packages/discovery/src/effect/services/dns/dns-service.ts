/* eslint-disable @typescript-eslint/explicit-function-return-type */

import type { IEnr } from "@waku/interfaces";
import { Context, Effect, Layer, Schedule, Stream } from "effect";

import { ENRTree } from "../../../dns/enrtree.js";
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

    // DNS tree cache to avoid redundant requests - matches original implementation
    const dnsTreeCache: { [key: string]: string } = {};

    // Helper to get TXT record with caching - matches original _getTXTRecord
    const getTXTRecord = (
      subdomain: string,
      baseDomain: string
    ): Effect.Effect<string, NetworkTimeoutError> =>
      Effect.gen(function* () {
        if (dnsTreeCache[subdomain]) {
          return dnsTreeCache[subdomain];
        }

        // Location is either the top level tree entry host or a subdomain of it.
        // This matches the original logic exactly
        const location =
          subdomain !== baseDomain ? `${subdomain}.${baseDomain}` : baseDomain;

        const records = yield* dnsClient.fetchRecords(location, "").pipe(
          Effect.timeout("30 seconds"),
          Effect.mapError(
            () =>
              new NetworkTimeoutError({
                operation: `DNS lookup for ${location}`,
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

        if (records.length === 0) {
          return yield* Effect.fail(
            new NetworkTimeoutError({
              operation: `DNS lookup for ${location}`,
              timeoutMs: 30000
            })
          );
        }

        // Join multiple records like original implementation
        const result = records.join("");
        dnsTreeCache[subdomain] = result;
        return result;
      });

    // Helper to search DNS tree recursively - matches original _search method exactly
    const searchTree = (
      subdomain: string,
      baseDomain: string,
      publicKey: string,
      visited: { [key: string]: boolean }
    ): Effect.Effect<readonly IEnr[], NetworkTimeoutError> =>
      Effect.gen(function* () {
        // console.log(`[DNS Service] searchTree called with subdomain='${subdomain}', baseDomain='${baseDomain}`);

        const entry = yield* getTXTRecord(subdomain, baseDomain).pipe(
          Effect.catchAll(() => Effect.succeed(""))
        );

        if (!entry) {
          return [];
        }

        // console.log(`[DNS Service] Got DNS entry: ${entry.substring(0, 80)}...`);

        visited[subdomain] = true;

        // Determine entry type
        let entryType = "";
        if (entry.startsWith(ENRTree.ROOT_PREFIX))
          entryType = ENRTree.ROOT_PREFIX;
        else if (entry.startsWith(ENRTree.BRANCH_PREFIX))
          entryType = ENRTree.BRANCH_PREFIX;
        else if (entry.startsWith(ENRTree.RECORD_PREFIX))
          entryType = ENRTree.RECORD_PREFIX;

        try {
          switch (entryType) {
            case ENRTree.ROOT_PREFIX: {
              const next = ENRTree.parseAndVerifyRoot(entry, publicKey);
              return yield* searchTree(next, baseDomain, publicKey, visited);
            }
            case ENRTree.BRANCH_PREFIX: {
              const branches = ENRTree.parseBranch(entry);
              // Select random path like original - for now just take the first available
              let selectedBranch = null;
              for (const branch of branches) {
                if (!visited[branch]) {
                  selectedBranch = branch;
                  break;
                }
              }
              if (selectedBranch) {
                return yield* searchTree(
                  selectedBranch,
                  baseDomain,
                  publicKey,
                  visited
                );
              }
              return [];
            }
            case ENRTree.RECORD_PREFIX: {
              // console.log(`[DNS Service] Found ENR record: ${entry.substring(0, 50)}...`);

              const enr = yield* enrParser.parseEnr(entry).pipe(
                // Effect.tap((enr) => Effect.sync(() => {
                //   console.log(`[DNS Service] Successfully parsed ENR, peer ID: ${enr.peerId}`);
                // })),
                // Effect.tapError((error) => Effect.sync(() => {
                //   console.log(`[DNS Service] Failed to parse ENR:`, error);
                // })),
                Effect.orElseSucceed(() => null)
              );
              return enr ? [enr] : [];
            }
            default:
              return [];
          }
        } catch (error) {
          // Log the error but continue processing
          return [];
        }
      });

    const discoverFromUrl = (enrUrl: string) =>
      Effect.gen(function* () {
        // Parse ENR tree URL
        const treeUrl = yield* enrParser.parseTreeUrl(enrUrl);

        // Search the DNS tree starting from the root
        const enrs = yield* searchTree(
          treeUrl.domain,
          treeUrl.domain,
          treeUrl.publicKey || "",
          {}
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

        return peers;
      }).pipe(Effect.orElseSucceed(() => [] as readonly DiscoveredPeer[]));

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
        Stream.mapConcat((peers) => peers)
      );

    const stop = () => Effect.void;

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
