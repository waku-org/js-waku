export {
  readRlnGetMembershipInfo,
  readRlnCurrentTotalRateLimit,
  readRlnMaxMembershipRateLimit,
  readRlnIsExpired,
  readRlnIsInGracePeriod,
  readRlnMemberships,
  writeRlnRegister,
  writeRlnRegisterWithPermit,
  writeRlnEraseMemberships,
  writeRlnExtendMemberships,
  simulateRlnRegister,
  simulateRlnRegisterWithPermit,
  simulateRlnEraseMemberships,
  simulateRlnExtendMemberships,
  watchRlnMembershipRegisteredEvent,
  watchRlnMembershipErasedEvent,
  watchRlnMembershipExpiredEvent,
  readPriceCalculatorCalculate,
  rlnAbi,
  rlnAddress,
  priceCalculatorAbi,
  priceCalculatorAddress
} from "../generated/wagmi.js";

export class WagmiRLNContract {}

export type MembershipInfo = {
  membershipRateLimit: bigint;
  holder: string;
  index: number;
  gracePeriodStartTimestamp: bigint;
  exists: boolean;
};

export type RateLimitTier = "LOW" | "MEDIUM" | "HIGH";

export const RATE_LIMIT_TIERS = {
  LOW: 20,
  MEDIUM: 200,
  HIGH: 600
} as const;
