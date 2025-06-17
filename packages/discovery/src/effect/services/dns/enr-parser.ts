import { EnrDecoder } from "@waku/enr";
import type { IEnr } from "@waku/interfaces";
import { Context, Effect, Layer } from "effect";

import { EnrParsingError } from "../common/errors.js";

/**
 * ENR tree URL components
 */
export interface EnrTreeUrl {
  readonly domain: string;
  readonly publicKey?: string;
  readonly linkPrefix: string;
}

/**
 * ENR parser service
 */
export interface EnrParserService {
  readonly parseTreeUrl: (
    url: string
  ) => Effect.Effect<EnrTreeUrl, EnrParsingError>;
  readonly parseEnr: (record: string) => Effect.Effect<IEnr, EnrParsingError>;
}

/**
 * ENR Parser tag
 */
export const EnrParser = Context.GenericTag<EnrParserService>("EnrParser");

/**
 * ENR parser implementation
 */
export const EnrParserLive = Layer.succeed(EnrParser, {
  parseTreeUrl: (url: string) =>
    Effect.try({
      try: () => {
        // Parse enrtree://PUBLICKEY@domain format
        const match = url.match(/^enrtree:\/\/([A-Z0-9]+)@(.+)$/);

        if (!match) {
          throw new Error("Invalid ENR tree URL format");
        }

        const [, publicKey, domain] = match;

        return {
          domain,
          publicKey,
          linkPrefix: "enrtree-branch:"
        } satisfies EnrTreeUrl;
      },
      catch: (error) =>
        new EnrParsingError({
          record: url,
          reason: "Failed to parse ENR tree URL",
          cause: error
        })
    }),

  parseEnr: (record: string) =>
    Effect.tryPromise({
      try: async () => {
        // EnrDecoder.fromString expects the full enr: prefix
        const enrString = record.startsWith("enr:") ? record : `enr:${record}`;
        const enr = await EnrDecoder.fromString(enrString);
        return enr as IEnr;
      },
      catch: (error) =>
        new EnrParsingError({
          record,
          reason: "Failed to parse ENR record",
          cause: error
        })
    })
} satisfies EnrParserService);
