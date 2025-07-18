import {
  createReadContract,
  createSimulateContract,
  createWatchContractEvent,
  createWriteContract
} from "wagmi/codegen";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PriceCalculator
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const priceCalculatorAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "_token", internalType: "address", type: "address" },
      {
        name: "_pricePerMessagePerEpoch",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    stateMutability: "nonpayable"
  },
  { type: "error", inputs: [], name: "OnlyTokensAllowed" },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "previousOwner",
        internalType: "address",
        type: "address",
        indexed: true
      },
      {
        name: "newOwner",
        internalType: "address",
        type: "address",
        indexed: true
      }
    ],
    name: "OwnershipTransferred"
  },
  {
    type: "function",
    inputs: [{ name: "_rateLimit", internalType: "uint32", type: "uint32" }],
    name: "calculate",
    outputs: [
      { name: "", internalType: "address", type: "address" },
      { name: "", internalType: "uint256", type: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "owner",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "pricePerMessagePerEpoch",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "_token", internalType: "address", type: "address" },
      {
        name: "_pricePerMessagePerEpoch",
        internalType: "uint256",
        type: "uint256"
      }
    ],
    name: "setTokenAndPrice",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [],
    name: "token",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [{ name: "newOwner", internalType: "address", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

/**
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const priceCalculatorAddress = {
  59141: "0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644"
} as const;

/**
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const priceCalculatorConfig = {
  address: priceCalculatorAddress,
  abi: priceCalculatorAbi
} as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// RLN
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const rlnAbi = [
  { type: "constructor", inputs: [], stateMutability: "nonpayable" },
  {
    type: "error",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "CannotEraseActiveMembership"
  },
  { type: "error", inputs: [], name: "CannotExceedMaxTotalRateLimit" },
  {
    type: "error",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "CannotExtendNonGracePeriodMembership"
  },
  {
    type: "error",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "InvalidIdCommitment"
  },
  { type: "error", inputs: [], name: "InvalidMembershipRateLimit" },
  {
    type: "error",
    inputs: [
      { name: "startIndex", internalType: "uint256", type: "uint256" },
      { name: "endIndex", internalType: "uint256", type: "uint256" }
    ],
    name: "InvalidPaginationQuery"
  },
  {
    type: "error",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "MembershipDoesNotExist"
  },
  {
    type: "error",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "NonHolderCannotEraseGracePeriodMembership"
  },
  {
    type: "error",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "NonHolderCannotExtend"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "previousAdmin",
        internalType: "address",
        type: "address",
        indexed: false
      },
      {
        name: "newAdmin",
        internalType: "address",
        type: "address",
        indexed: false
      }
    ],
    name: "AdminChanged"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "beacon",
        internalType: "address",
        type: "address",
        indexed: true
      }
    ],
    name: "BeaconUpgraded"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "version", internalType: "uint8", type: "uint8", indexed: false }
    ],
    name: "Initialized"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "idCommitment",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      },
      {
        name: "membershipRateLimit",
        internalType: "uint32",
        type: "uint32",
        indexed: false
      },
      { name: "index", internalType: "uint32", type: "uint32", indexed: false }
    ],
    name: "MembershipErased"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "idCommitment",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      },
      {
        name: "membershipRateLimit",
        internalType: "uint32",
        type: "uint32",
        indexed: false
      },
      { name: "index", internalType: "uint32", type: "uint32", indexed: false }
    ],
    name: "MembershipExpired"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "idCommitment",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      },
      {
        name: "membershipRateLimit",
        internalType: "uint32",
        type: "uint32",
        indexed: false
      },
      { name: "index", internalType: "uint32", type: "uint32", indexed: false },
      {
        name: "newGracePeriodStartTimestamp",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      }
    ],
    name: "MembershipExtended"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "idCommitment",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      },
      {
        name: "membershipRateLimit",
        internalType: "uint256",
        type: "uint256",
        indexed: false
      },
      { name: "index", internalType: "uint32", type: "uint32", indexed: false }
    ],
    name: "MembershipRegistered"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "previousOwner",
        internalType: "address",
        type: "address",
        indexed: true
      },
      {
        name: "newOwner",
        internalType: "address",
        type: "address",
        indexed: true
      }
    ],
    name: "OwnershipTransferred"
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "implementation",
        internalType: "address",
        type: "address",
        indexed: true
      }
    ],
    name: "Upgraded"
  },
  {
    type: "function",
    inputs: [],
    name: "MAX_MEMBERSHIP_SET_SIZE",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "MERKLE_TREE_DEPTH",
    outputs: [{ name: "", internalType: "uint8", type: "uint8" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "Q",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "activeDurationForNewMemberships",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "currentTotalRateLimit",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "deployedBlockNumber",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "holder", internalType: "address", type: "address" },
      { name: "token", internalType: "address", type: "address" }
    ],
    name: "depositsToWithdraw",
    outputs: [{ name: "balance", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitments", internalType: "uint256[]", type: "uint256[]" }
    ],
    name: "eraseMemberships",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitments", internalType: "uint256[]", type: "uint256[]" },
      { name: "eraseFromMembershipSet", internalType: "bool", type: "bool" }
    ],
    name: "eraseMemberships",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitments", internalType: "uint256[]", type: "uint256[]" }
    ],
    name: "extendMemberships",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "getMembershipInfo",
    outputs: [
      { name: "", internalType: "uint32", type: "uint32" },
      { name: "", internalType: "uint32", type: "uint32" },
      { name: "", internalType: "uint256", type: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [{ name: "index", internalType: "uint40", type: "uint40" }],
    name: "getMerkleProof",
    outputs: [{ name: "", internalType: "uint256[20]", type: "uint256[20]" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "startIndex", internalType: "uint32", type: "uint32" },
      { name: "endIndex", internalType: "uint32", type: "uint32" }
    ],
    name: "getRateCommitmentsInRangeBoundsInclusive",
    outputs: [{ name: "", internalType: "uint256[]", type: "uint256[]" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "gracePeriodDurationForNewMemberships",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    name: "indicesOfLazilyErasedMemberships",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "_priceCalculator", internalType: "address", type: "address" },
      { name: "_maxTotalRateLimit", internalType: "uint32", type: "uint32" },
      {
        name: "_minMembershipRateLimit",
        internalType: "uint32",
        type: "uint32"
      },
      {
        name: "_maxMembershipRateLimit",
        internalType: "uint32",
        type: "uint32"
      },
      { name: "_activeDuration", internalType: "uint32", type: "uint32" },
      { name: "_gracePeriod", internalType: "uint32", type: "uint32" }
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "_idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "isExpired",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "_idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "isInGracePeriod",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "isInMembershipSet",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "isValidIdCommitment",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "pure"
  },
  {
    type: "function",
    inputs: [{ name: "rateLimit", internalType: "uint32", type: "uint32" }],
    name: "isValidMembershipRateLimit",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "maxMembershipRateLimit",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "maxTotalRateLimit",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "_idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "membershipExpirationTimestamp",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" }
    ],
    name: "memberships",
    outputs: [
      { name: "depositAmount", internalType: "uint256", type: "uint256" },
      { name: "activeDuration", internalType: "uint32", type: "uint32" },
      {
        name: "gracePeriodStartTimestamp",
        internalType: "uint256",
        type: "uint256"
      },
      { name: "gracePeriodDuration", internalType: "uint32", type: "uint32" },
      { name: "rateLimit", internalType: "uint32", type: "uint32" },
      { name: "index", internalType: "uint32", type: "uint32" },
      { name: "holder", internalType: "address", type: "address" },
      { name: "token", internalType: "address", type: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "merkleTree",
    outputs: [
      { name: "maxIndex", internalType: "uint40", type: "uint40" },
      { name: "numberOfLeaves", internalType: "uint40", type: "uint40" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "minMembershipRateLimit",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "nextFreeIndex",
    outputs: [{ name: "", internalType: "uint32", type: "uint32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "owner",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "priceCalculator",
    outputs: [
      { name: "", internalType: "contract IPriceCalculator", type: "address" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [],
    name: "proxiableUUID",
    outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      { name: "idCommitment", internalType: "uint256", type: "uint256" },
      { name: "rateLimit", internalType: "uint32", type: "uint32" },
      {
        name: "idCommitmentsToErase",
        internalType: "uint256[]",
        type: "uint256[]"
      }
    ],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "owner", internalType: "address", type: "address" },
      { name: "deadline", internalType: "uint256", type: "uint256" },
      { name: "v", internalType: "uint8", type: "uint8" },
      { name: "r", internalType: "bytes32", type: "bytes32" },
      { name: "s", internalType: "bytes32", type: "bytes32" },
      { name: "idCommitment", internalType: "uint256", type: "uint256" },
      { name: "rateLimit", internalType: "uint32", type: "uint32" },
      {
        name: "idCommitmentsToErase",
        internalType: "uint256[]",
        type: "uint256[]"
      }
    ],
    name: "registerWithPermit",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [],
    name: "root",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    inputs: [
      {
        name: "_activeDurationForNewMembership",
        internalType: "uint32",
        type: "uint32"
      }
    ],
    name: "setActiveDuration",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      {
        name: "_gracePeriodDurationForNewMembership",
        internalType: "uint32",
        type: "uint32"
      }
    ],
    name: "setGracePeriodDuration",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      {
        name: "_maxMembershipRateLimit",
        internalType: "uint32",
        type: "uint32"
      }
    ],
    name: "setMaxMembershipRateLimit",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "_maxTotalRateLimit", internalType: "uint32", type: "uint32" }
    ],
    name: "setMaxTotalRateLimit",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      {
        name: "_minMembershipRateLimit",
        internalType: "uint32",
        type: "uint32"
      }
    ],
    name: "setMinMembershipRateLimit",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "_priceCalculator", internalType: "address", type: "address" }
    ],
    name: "setPriceCalculator",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [{ name: "newOwner", internalType: "address", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "newImplementation", internalType: "address", type: "address" }
    ],
    name: "upgradeTo",
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    inputs: [
      { name: "newImplementation", internalType: "address", type: "address" },
      { name: "data", internalType: "bytes", type: "bytes" }
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    inputs: [{ name: "token", internalType: "address", type: "address" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

/**
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const rlnAddress = {
  59141: "0xB9cd878C90E49F797B4431fBF4fb333108CB90e6"
} as const;

/**
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const rlnConfig = { address: rlnAddress, abi: rlnAbi } as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Action
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link priceCalculatorAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const readPriceCalculator = /*#__PURE__*/ createReadContract({
  abi: priceCalculatorAbi,
  address: priceCalculatorAddress
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"calculate"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const readPriceCalculatorCalculate = /*#__PURE__*/ createReadContract({
  abi: priceCalculatorAbi,
  address: priceCalculatorAddress,
  functionName: "calculate"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"owner"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const readPriceCalculatorOwner = /*#__PURE__*/ createReadContract({
  abi: priceCalculatorAbi,
  address: priceCalculatorAddress,
  functionName: "owner"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"pricePerMessagePerEpoch"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const readPriceCalculatorPricePerMessagePerEpoch =
  /*#__PURE__*/ createReadContract({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    functionName: "pricePerMessagePerEpoch"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"token"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const readPriceCalculatorToken = /*#__PURE__*/ createReadContract({
  abi: priceCalculatorAbi,
  address: priceCalculatorAddress,
  functionName: "token"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link priceCalculatorAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const writePriceCalculator = /*#__PURE__*/ createWriteContract({
  abi: priceCalculatorAbi,
  address: priceCalculatorAddress
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const writePriceCalculatorRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    functionName: "renounceOwnership"
  });

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"setTokenAndPrice"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const writePriceCalculatorSetTokenAndPrice =
  /*#__PURE__*/ createWriteContract({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    functionName: "setTokenAndPrice"
  });

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const writePriceCalculatorTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    functionName: "transferOwnership"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link priceCalculatorAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const simulatePriceCalculator = /*#__PURE__*/ createSimulateContract({
  abi: priceCalculatorAbi,
  address: priceCalculatorAddress
});

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const simulatePriceCalculatorRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    functionName: "renounceOwnership"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"setTokenAndPrice"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const simulatePriceCalculatorSetTokenAndPrice =
  /*#__PURE__*/ createSimulateContract({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    functionName: "setTokenAndPrice"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link priceCalculatorAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const simulatePriceCalculatorTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    functionName: "transferOwnership"
  });

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link priceCalculatorAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const watchPriceCalculatorEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: priceCalculatorAbi, address: priceCalculatorAddress }
);

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link priceCalculatorAbi}__ and `eventName` set to `"OwnershipTransferred"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xBcfC0660Df69f53ab409F32bb18A3fb625fcE644)
 */
export const watchPriceCalculatorOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: priceCalculatorAbi,
    address: priceCalculatorAddress,
    eventName: "OwnershipTransferred"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRln = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"MAX_MEMBERSHIP_SET_SIZE"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMaxMembershipSetSize = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "MAX_MEMBERSHIP_SET_SIZE"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"MERKLE_TREE_DEPTH"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMerkleTreeDepth = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "MERKLE_TREE_DEPTH"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"Q"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnQ = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "Q"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"activeDurationForNewMemberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnActiveDurationForNewMemberships =
  /*#__PURE__*/ createReadContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "activeDurationForNewMemberships"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"currentTotalRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnCurrentTotalRateLimit = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "currentTotalRateLimit"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"deployedBlockNumber"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnDeployedBlockNumber = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "deployedBlockNumber"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"depositsToWithdraw"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnDepositsToWithdraw = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "depositsToWithdraw"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"getMembershipInfo"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnGetMembershipInfo = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "getMembershipInfo"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"getMerkleProof"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnGetMerkleProof = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "getMerkleProof"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"getRateCommitmentsInRangeBoundsInclusive"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnGetRateCommitmentsInRangeBoundsInclusive =
  /*#__PURE__*/ createReadContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "getRateCommitmentsInRangeBoundsInclusive"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"gracePeriodDurationForNewMemberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnGracePeriodDurationForNewMemberships =
  /*#__PURE__*/ createReadContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "gracePeriodDurationForNewMemberships"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"indicesOfLazilyErasedMemberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnIndicesOfLazilyErasedMemberships =
  /*#__PURE__*/ createReadContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "indicesOfLazilyErasedMemberships"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"isExpired"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnIsExpired = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "isExpired"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"isInGracePeriod"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnIsInGracePeriod = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "isInGracePeriod"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"isInMembershipSet"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnIsInMembershipSet = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "isInMembershipSet"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"isValidIdCommitment"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnIsValidIdCommitment = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "isValidIdCommitment"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"isValidMembershipRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnIsValidMembershipRateLimit =
  /*#__PURE__*/ createReadContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "isValidMembershipRateLimit"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"maxMembershipRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMaxMembershipRateLimit = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "maxMembershipRateLimit"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"maxTotalRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMaxTotalRateLimit = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "maxTotalRateLimit"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"membershipExpirationTimestamp"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMembershipExpirationTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "membershipExpirationTimestamp"
  });

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"memberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMemberships = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "memberships"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"merkleTree"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMerkleTree = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "merkleTree"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"minMembershipRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnMinMembershipRateLimit = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "minMembershipRateLimit"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"nextFreeIndex"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnNextFreeIndex = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "nextFreeIndex"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"owner"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnOwner = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "owner"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"priceCalculator"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnPriceCalculator = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "priceCalculator"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"proxiableUUID"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnProxiableUuid = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "proxiableUUID"
});

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"root"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const readRlnRoot = /*#__PURE__*/ createReadContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "root"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRln = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"eraseMemberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnEraseMemberships = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "eraseMemberships"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"extendMemberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnExtendMemberships = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "extendMemberships"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"initialize"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnInitialize = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "initialize"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"register"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnRegister = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "register"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"registerWithPermit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnRegisterWithPermit = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "registerWithPermit"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnRenounceOwnership = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "renounceOwnership"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setActiveDuration"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnSetActiveDuration = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "setActiveDuration"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setGracePeriodDuration"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnSetGracePeriodDuration = /*#__PURE__*/ createWriteContract(
  { abi: rlnAbi, address: rlnAddress, functionName: "setGracePeriodDuration" }
);

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setMaxMembershipRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnSetMaxMembershipRateLimit =
  /*#__PURE__*/ createWriteContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setMaxMembershipRateLimit"
  });

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setMaxTotalRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnSetMaxTotalRateLimit = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "setMaxTotalRateLimit"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setMinMembershipRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnSetMinMembershipRateLimit =
  /*#__PURE__*/ createWriteContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setMinMembershipRateLimit"
  });

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setPriceCalculator"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnSetPriceCalculator = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "setPriceCalculator"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnTransferOwnership = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "transferOwnership"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"upgradeTo"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnUpgradeTo = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "upgradeTo"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"upgradeToAndCall"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnUpgradeToAndCall = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "upgradeToAndCall"
});

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"withdraw"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const writeRlnWithdraw = /*#__PURE__*/ createWriteContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "withdraw"
});

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRln = /*#__PURE__*/ createSimulateContract({
  abi: rlnAbi,
  address: rlnAddress
});

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"eraseMemberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnEraseMemberships = /*#__PURE__*/ createSimulateContract(
  { abi: rlnAbi, address: rlnAddress, functionName: "eraseMemberships" }
);

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"extendMemberships"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnExtendMemberships =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "extendMemberships"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"initialize"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnInitialize = /*#__PURE__*/ createSimulateContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "initialize"
});

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"register"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnRegister = /*#__PURE__*/ createSimulateContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "register"
});

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"registerWithPermit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnRegisterWithPermit =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "registerWithPermit"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "renounceOwnership"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setActiveDuration"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnSetActiveDuration =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setActiveDuration"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setGracePeriodDuration"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnSetGracePeriodDuration =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setGracePeriodDuration"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setMaxMembershipRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnSetMaxMembershipRateLimit =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setMaxMembershipRateLimit"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setMaxTotalRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnSetMaxTotalRateLimit =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setMaxTotalRateLimit"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setMinMembershipRateLimit"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnSetMinMembershipRateLimit =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setMinMembershipRateLimit"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"setPriceCalculator"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnSetPriceCalculator =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "setPriceCalculator"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: rlnAbi,
    address: rlnAddress,
    functionName: "transferOwnership"
  });

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"upgradeTo"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnUpgradeTo = /*#__PURE__*/ createSimulateContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "upgradeTo"
});

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"upgradeToAndCall"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnUpgradeToAndCall = /*#__PURE__*/ createSimulateContract(
  { abi: rlnAbi, address: rlnAddress, functionName: "upgradeToAndCall" }
);

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link rlnAbi}__ and `functionName` set to `"withdraw"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const simulateRlnWithdraw = /*#__PURE__*/ createSimulateContract({
  abi: rlnAbi,
  address: rlnAddress,
  functionName: "withdraw"
});

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: rlnAbi,
  address: rlnAddress
});

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"AdminChanged"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnAdminChangedEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: rlnAbi, address: rlnAddress, eventName: "AdminChanged" }
);

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"BeaconUpgraded"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnBeaconUpgradedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rlnAbi,
    address: rlnAddress,
    eventName: "BeaconUpgraded"
  });

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"Initialized"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnInitializedEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: rlnAbi,
  address: rlnAddress,
  eventName: "Initialized"
});

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"MembershipErased"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnMembershipErasedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rlnAbi,
    address: rlnAddress,
    eventName: "MembershipErased"
  });

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"MembershipExpired"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnMembershipExpiredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rlnAbi,
    address: rlnAddress,
    eventName: "MembershipExpired"
  });

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"MembershipExtended"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnMembershipExtendedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rlnAbi,
    address: rlnAddress,
    eventName: "MembershipExtended"
  });

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"MembershipRegistered"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnMembershipRegisteredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rlnAbi,
    address: rlnAddress,
    eventName: "MembershipRegistered"
  });

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"OwnershipTransferred"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: rlnAbi,
    address: rlnAddress,
    eventName: "OwnershipTransferred"
  });

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link rlnAbi}__ and `eventName` set to `"Upgraded"`
 *
 * [__View Contract on Linea Sepolia Testnet Etherscan__](https://sepolia.lineascan.build/address/0xb9cd878c90e49f797b4431fbf4fb333108cb90e6)
 */
export const watchRlnUpgradedEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: rlnAbi,
  address: rlnAddress,
  eventName: "Upgraded"
});
