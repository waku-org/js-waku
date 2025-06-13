import * as Schema from "@effect/schema/Schema";
import { Config } from "effect";

/**
 * DNS Discovery configuration schema
 */
export const DnsDiscoveryConfigSchema = Schema.Struct({
  enrUrls: Schema.Array(Schema.String),
  wantedNodeCapabilityCount: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Number })
  ),
  tagName: Schema.optional(Schema.String),
  tagValue: Schema.optional(Schema.Number),
  tagTTL: Schema.optional(Schema.Number)
});

/**
 * Peer Exchange configuration schema
 */
export const PeerExchangeConfigSchema = Schema.Struct({
  numPeersToRequest: Schema.Number.pipe(Schema.positive(), Schema.int()),
  queryInterval: Schema.Number.pipe(Schema.positive()),
  maxRetries: Schema.Number.pipe(Schema.nonNegative(), Schema.int()),
  tagName: Schema.optional(Schema.String),
  tagValue: Schema.optional(Schema.Number),
  tagTTL: Schema.optional(Schema.Number)
});

/**
 * Local Cache configuration schema
 */
export const LocalCacheConfigSchema = Schema.Struct({
  maxPeers: Schema.Number.pipe(Schema.positive(), Schema.int()),
  ttl: Schema.Number.pipe(Schema.positive()),
  storageKey: Schema.String
});

/**
 * Load DNS discovery configuration
 */
export const DnsDiscoveryConfig = Config.all({
  enrUrls: Config.array(Config.string("dns.enrUrls")).pipe(
    Config.withDefault([])
  ),
  tagName: Config.string("dns.tagName").pipe(Config.withDefault("bootstrap")),
  tagValue: Config.number("dns.tagValue").pipe(Config.withDefault(50)),
  tagTTL: Config.number("dns.tagTTL").pipe(Config.withDefault(120000))
});

/**
 * Load peer exchange configuration
 */
export const PeerExchangeConfig = Config.all({
  numPeersToRequest: Config.number("peerExchange.numPeersToRequest").pipe(
    Config.withDefault(10)
  ),
  queryInterval: Config.number("peerExchange.queryInterval").pipe(
    Config.withDefault(300000) // 5 minutes
  ),
  maxRetries: Config.number("peerExchange.maxRetries").pipe(
    Config.withDefault(3)
  ),
  tagName: Config.string("peerExchange.tagName").pipe(
    Config.withDefault("peer-exchange")
  ),
  tagValue: Config.number("peerExchange.tagValue").pipe(Config.withDefault(50)),
  tagTTL: Config.number("peerExchange.tagTTL").pipe(Config.withDefault(120000))
});

/**
 * Load local cache configuration
 */
export const LocalCacheConfig = Config.all({
  maxPeers: Config.number("cache.maxPeers").pipe(Config.withDefault(100)),
  ttl: Config.number("cache.ttl").pipe(
    Config.withDefault(3600000) // 1 hour
  ),
  storageKey: Config.string("cache.storageKey").pipe(
    Config.withDefault("waku:discovery:cache")
  )
});
