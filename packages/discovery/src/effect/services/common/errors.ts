import type { PeerId } from "@libp2p/interface";
import { Data } from "effect";

/**
 * Base error type for all discovery errors
 */
export type DiscoveryError =
  | DnsResolutionError
  | EnrParsingError
  | PeerExchangeError
  | NetworkTimeoutError
  | InvalidPeerError
  | CacheError
  | ProtocolError;

/**
 * DNS resolution failed
 */
export class DnsResolutionError extends Data.TaggedError("DnsResolutionError")<{
  readonly domain: string;
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Failed to parse ENR record
 */
export class EnrParsingError extends Data.TaggedError("EnrParsingError")<{
  readonly record: string;
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Peer exchange protocol error
 */
export class PeerExchangeError extends Data.TaggedError("PeerExchangeError")<{
  readonly peer: PeerId;
  readonly operation: "query" | "response" | "decode";
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Network operation timed out
 */
export class NetworkTimeoutError extends Data.TaggedError(
  "NetworkTimeoutError"
)<{
  readonly operation: string;
  readonly timeoutMs: number;
}> {}

/**
 * Invalid peer information
 */
export class InvalidPeerError extends Data.TaggedError("InvalidPeerError")<{
  readonly peerId?: string;
  readonly reason: string;
  readonly multiaddrs?: string[];
}> {}

/**
 * Cache operation failed
 */
export class CacheError extends Data.TaggedError("CacheError")<{
  readonly operation: "read" | "write" | "delete" | "clear";
  readonly key?: string;
  readonly reason: string;
  readonly cause?: unknown;
}> {}

/**
 * Protocol-level error
 */
export class ProtocolError extends Data.TaggedError("ProtocolError")<{
  readonly protocol: string;
  readonly reason: string;
  readonly cause?: unknown;
}> {}
