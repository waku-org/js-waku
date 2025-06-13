import type { PeerInfo } from "@libp2p/interface";
import type { IEnr, ShardInfo } from "@waku/interfaces";
import { encodeRelayShard } from "@waku/utils";
import { Effect } from "effect";

import { InvalidPeerError } from "./errors.js";
import type { DiscoveredPeer, DiscoverySource } from "./types.js";

/**
 * Convert ENR to PeerInfo
 */
export function enrToPeerInfo(
  enr: IEnr
): Effect.Effect<PeerInfo, InvalidPeerError> {
  return Effect.gen(function* () {
    const peerInfo = enr.peerInfo;

    if (!peerInfo) {
      return yield* Effect.fail(
        new InvalidPeerError({
          reason: "ENR does not contain peer info"
        })
      );
    }

    if (!peerInfo.multiaddrs || peerInfo.multiaddrs.length === 0) {
      return yield* Effect.fail(
        new InvalidPeerError({
          peerId: peerInfo.id?.toString(),
          reason: "No multiaddrs found in peer info"
        })
      );
    }

    return peerInfo;
  });
}

/**
 * Create a DiscoveredPeer from ENR
 */
export function enrToDiscoveredPeer(
  enr: IEnr,
  source: DiscoverySource
): Effect.Effect<DiscoveredPeer, InvalidPeerError> {
  return Effect.gen(function* () {
    const peerInfo = yield* enrToPeerInfo(enr);

    return {
      peerInfo,
      enr,
      shardInfo: enr.shardInfo,
      discoveredAt: new Date(),
      source
    };
  });
}

/**
 * Check if peer meets capability requirements
 */
export function meetsCapabilityRequirements(
  enr: IEnr,
  requirements: Partial<Record<string, number>>
): boolean {
  if (!enr.waku2 || Object.keys(requirements).length === 0) {
    return true;
  }

  for (const [capability, minCount] of Object.entries(requirements)) {
    const peerCount = (enr.waku2 as any)[capability] || 0;
    if (peerCount < (minCount ?? 0)) {
      return false;
    }
  }

  return true;
}

/**
 * Filter ENRs by capability requirements
 */
export function filterByCapabilities(
  enrs: readonly IEnr[],
  requirements: Partial<Record<string, number>>
): Effect.Effect<readonly IEnr[]> {
  return Effect.succeed(
    enrs.filter((enr) => meetsCapabilityRequirements(enr, requirements))
  );
}

/**
 * Create peer store tags
 */
export function createPeerTags(
  tagName: string,
  tagValue: number,
  tagTTL: number
): Record<string, { value: number; ttl: number }> {
  return {
    [tagName]: {
      value: tagValue,
      ttl: tagTTL
    }
  };
}

/**
 * Encode shard info for peer store metadata
 */
export function encodeShardInfo(
  shardInfo: ShardInfo | undefined
): { shardInfo: Uint8Array } | undefined {
  if (!shardInfo) {
    return undefined;
  }

  return {
    shardInfo: encodeRelayShard(shardInfo)
  };
}

/**
 * Check if a peer is valid
 */
export function validatePeer(
  peer: PeerInfo
): Effect.Effect<PeerInfo, InvalidPeerError> {
  return Effect.gen(function* () {
    if (!peer.id) {
      return yield* Effect.fail(
        new InvalidPeerError({
          reason: "Peer has no ID"
        })
      );
    }

    if (!peer.multiaddrs || peer.multiaddrs.length === 0) {
      return yield* Effect.fail(
        new InvalidPeerError({
          peerId: peer.id.toString(),
          reason: "Peer has no multiaddrs"
        })
      );
    }

    return peer;
  });
}

/**
 * Deduplicate peers by ID
 */
export function deduplicatePeers<T extends { peerInfo: PeerInfo }>(
  peers: readonly T[]
): readonly T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const peer of peers) {
    const id = peer.peerInfo.id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      result.push(peer);
    }
  }

  return result;
}
