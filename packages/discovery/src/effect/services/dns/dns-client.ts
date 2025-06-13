/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { HttpClient, HttpClientRequest } from "@effect/platform";
import { Context, Effect, Layer } from "effect";

import { DnsResolutionError } from "../common/errors.js";

/**
 * DNS client service for resolving ENR trees
 */
export interface DnsClientService {
  readonly fetchRecords: (
    domain: string,
    publicKey?: string
  ) => Effect.Effect<readonly string[], DnsResolutionError>;
}

/**
 * DNS Client tag
 */
export const DnsClient = Context.GenericTag<DnsClientService>("DnsClient");

/**
 * DNS client implementation using DNS-over-HTTPS
 */
export const DnsClientLive = Layer.effect(
  DnsClient,
  Effect.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;

    const dnsOverHttpsProviders = [
      "https://dns.google/resolve",
      "https://cloudflare-dns.com/dns-query"
    ];

    const queryProvider = (provider: string, domain: string) =>
      HttpClientRequest.get(provider).pipe(
        HttpClientRequest.setUrlParams({
          name: domain,
          type: "TXT"
        }),
        HttpClientRequest.acceptJson,
        httpClient.execute,
        Effect.flatMap((response) => response.json),
        // Effect.tap((data: any) => {
        //   // eslint-disable-next-line no-console
        //   console.log(`[Effect DNS] Query ${domain} via ${provider}:`, JSON.stringify(data, null, 2));
        // }),
        Effect.map((data: any) => {
          const answers = data.Answer || [];
          const txtRecords = answers
            .filter((answer: any) => answer.type === 16) // TXT records
            .map((answer: any) => answer.data.replace(/"/g, ""));

          // console.log(`[Effect DNS] Extracted ${txtRecords.length} TXT records for ${domain}:`, txtRecords);
          return txtRecords;
        }),
        Effect.catchAll((error) =>
          Effect.fail(
            new DnsResolutionError({
              domain,
              reason: `Failed to query ${provider}`,
              cause: error
            })
          )
        )
      );

    const fetchRecords = (
      domain: string,
      _publicKey?: string
    ): Effect.Effect<readonly string[], DnsResolutionError> =>
      Effect.gen(function* () {
        // Try each DNS provider
        let lastError: DnsResolutionError | null = null;

        for (const provider of dnsOverHttpsProviders) {
          const result = yield* queryProvider(provider, domain).pipe(
            Effect.either
          );

          if (result._tag === "Right") {
            return result.right as readonly string[];
          }

          lastError = result.left;
        }

        // All providers failed
        return yield* Effect.fail(
          lastError ||
            new DnsResolutionError({
              domain,
              reason: "All DNS providers failed"
            })
        );
      });

    return {
      fetchRecords
    } satisfies DnsClientService;
  })
);
