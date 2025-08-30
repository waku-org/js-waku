import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * ParticipantId can be a string or converted to a numeric representation for XOR operations
 */
export type ParticipantId = string;

/**
 * Compute SHA256 hash and convert to integer for modulo operations
 * Uses first 8 bytes of hash for the integer conversion
 */
export function hashToInteger(input: string): bigint {
  const hashBytes = sha256(new TextEncoder().encode(input));
  // Use first 8 bytes for a 64-bit integer
  const view = new DataView(hashBytes.buffer, 0, 8);
  return view.getBigUint64(0, false); // big-endian
}

/**
 * Compute combined hash for (participantId, messageId) and convert to integer
 * This is used for T_req calculations and response group membership
 */
export function combinedHash(
  participantId: ParticipantId,
  messageId: string
): bigint {
  const combined = `${participantId}${messageId}`;
  return hashToInteger(combined);
}

/**
 * Convert ParticipantId to numeric representation for XOR operations
 * TODO: Not per spec, further review needed
 * The spec assumes participant IDs support XOR natively, but we're using
 * SHA256 hash to ensure consistent numeric representation for string IDs
 */
export function participantIdToNumeric(participantId: ParticipantId): bigint {
  return hashToInteger(participantId);
}

/**
 * Calculate XOR distance between two participant IDs
 * Used for T_resp calculations where distance affects response timing
 */
export function calculateXorDistance(
  participantId1: ParticipantId,
  participantId2: ParticipantId
): bigint {
  const numeric1 = participantIdToNumeric(participantId1);
  const numeric2 = participantIdToNumeric(participantId2);
  return numeric1 ^ numeric2;
}

/**
 * Helper to convert bigint to number for timing calculations
 * Ensures the result fits in JavaScript's number range
 */
export function bigintToNumber(value: bigint): number {
  // For timing calculations, we modulo by MAX_SAFE_INTEGER to ensure it fits
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(value % maxSafe);
}

/**
 * Calculate hash for a single string (used for message_id in T_resp)
 */
export function hashString(input: string): bigint {
  return hashToInteger(input);
}

/**
 * Convert a hash result to hex string for debugging/logging
 */
export function hashToHex(input: string): string {
  const hashBytes = sha256(new TextEncoder().encode(input));
  return bytesToHex(hashBytes);
}