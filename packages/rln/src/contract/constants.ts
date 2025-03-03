import { RLN_ABI } from "./abi.js";

export const SEPOLIA_CONTRACT = {
  chainId: 11155111,
  address: "0xCB33Aa5B38d79E3D9Fa8B10afF38AA201399a7e3",
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

export const DEFAULT_RATE_LIMIT = RATE_LIMIT_PARAMS.MAX_RATE;
