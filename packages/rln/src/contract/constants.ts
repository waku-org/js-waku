import { RLN_ABI } from "./abi.js";

export const LINEA_CONTRACT = {
  chainId: 59141,
  address: "0xb9cd878c90e49f797b4431fbf4fb333108cb90e6",
  abi: RLN_ABI
};

/**
 * Rate limit tiers (messages per epoch)
 * Each membership can specify a rate limit within these bounds.
 * @see https://github.com/waku-org/specs/blob/master/standards/core/rln-contract.md#implementation-suggestions
 */
export const RATE_LIMIT_TIERS = {
  LOW: 20, // Suggested minimum rate - 20 messages per epoch
  MEDIUM: 200,
  HIGH: 600 // Suggested maximum rate - 600 messages per epoch
} as const;

// Global rate limit parameters
export const RATE_LIMIT_PARAMS = {
  MIN_RATE: RATE_LIMIT_TIERS.LOW,
  MAX_RATE: RATE_LIMIT_TIERS.HIGH,
  MAX_TOTAL_RATE: 160_000, // Maximum total rate limit across all memberships
  EPOCH_LENGTH: 600 // Epoch length in seconds (10 minutes)
} as const;

/**
 * Default Q value for the RLN contract
 * This is the upper bound for the ID commitment
 * @see https://github.com/waku-org/specs/blob/master/standards/core/rln-contract.md#implementation-suggestions
 */
export const RLN_Q = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

export const DEFAULT_RATE_LIMIT = RATE_LIMIT_PARAMS.MAX_RATE;
