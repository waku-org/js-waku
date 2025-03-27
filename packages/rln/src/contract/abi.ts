export const RLN_ABI = [
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "CannotEraseActiveMembership",
    type: "error"
  },
  { inputs: [], name: "CannotExceedMaxTotalRateLimit", type: "error" },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "CannotExtendNonGracePeriodMembership",
    type: "error"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "InvalidIdCommitment",
    type: "error"
  },
  { inputs: [], name: "InvalidMembershipRateLimit", type: "error" },
  {
    inputs: [
      { internalType: "uint256", name: "startIndex", type: "uint256" },
      { internalType: "uint256", name: "endIndex", type: "uint256" }
    ],
    name: "InvalidPaginationQuery",
    type: "error"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "MembershipDoesNotExist",
    type: "error"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "NonHolderCannotEraseGracePeriodMembership",
    type: "error"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "NonHolderCannotExtend",
    type: "error"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "previousAdmin",
        type: "address"
      },
      {
        indexed: false,
        internalType: "address",
        name: "newAdmin",
        type: "address"
      }
    ],
    name: "AdminChanged",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "beacon",
        type: "address"
      }
    ],
    name: "BeaconUpgraded",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint8", name: "version", type: "uint8" }
    ],
    name: "Initialized",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "idCommitment",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint32",
        name: "membershipRateLimit",
        type: "uint32"
      },
      { indexed: false, internalType: "uint32", name: "index", type: "uint32" }
    ],
    name: "MembershipErased",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "idCommitment",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint32",
        name: "membershipRateLimit",
        type: "uint32"
      },
      { indexed: false, internalType: "uint32", name: "index", type: "uint32" }
    ],
    name: "MembershipExpired",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "idCommitment",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint32",
        name: "membershipRateLimit",
        type: "uint32"
      },
      { indexed: false, internalType: "uint32", name: "index", type: "uint32" },
      {
        indexed: false,
        internalType: "uint256",
        name: "newGracePeriodStartTimestamp",
        type: "uint256"
      }
    ],
    name: "MembershipExtended",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint256",
        name: "idCommitment",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "membershipRateLimit",
        type: "uint256"
      },
      { indexed: false, internalType: "uint32", name: "index", type: "uint32" }
    ],
    name: "MembershipRegistered",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address"
      }
    ],
    name: "OwnershipTransferred",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "implementation",
        type: "address"
      }
    ],
    name: "Upgraded",
    type: "event"
  },
  {
    inputs: [],
    name: "MAX_MEMBERSHIP_SET_SIZE",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "MERKLE_TREE_DEPTH",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "Q",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "activeDurationForNewMemberships",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "currentTotalRateLimit",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "deployedBlockNumber",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "holder", type: "address" },
      { internalType: "address", name: "token", type: "address" }
    ],
    name: "depositsToWithdraw",
    outputs: [{ internalType: "uint256", name: "balance", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256[]", name: "idCommitments", type: "uint256[]" }
    ],
    name: "eraseMemberships",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256[]", name: "idCommitments", type: "uint256[]" },
      { internalType: "bool", name: "eraseFromMembershipSet", type: "bool" }
    ],
    name: "eraseMemberships",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256[]", name: "idCommitments", type: "uint256[]" }
    ],
    name: "extendMemberships",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "getMembershipInfo",
    outputs: [
      { internalType: "uint32", name: "", type: "uint32" },
      { internalType: "uint32", name: "", type: "uint32" },
      { internalType: "uint256", name: "", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint40", name: "index", type: "uint40" }],
    name: "getMerkleProof",
    outputs: [{ internalType: "uint256[20]", name: "", type: "uint256[20]" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint32", name: "startIndex", type: "uint32" },
      { internalType: "uint32", name: "endIndex", type: "uint32" }
    ],
    name: "getRateCommitmentsInRangeBoundsInclusive",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "gracePeriodDurationForNewMemberships",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "indicesOfLazilyErasedMemberships",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "_priceCalculator", type: "address" },
      { internalType: "uint32", name: "_maxTotalRateLimit", type: "uint32" },
      {
        internalType: "uint32",
        name: "_minMembershipRateLimit",
        type: "uint32"
      },
      {
        internalType: "uint32",
        name: "_maxMembershipRateLimit",
        type: "uint32"
      },
      { internalType: "uint32", name: "_activeDuration", type: "uint32" },
      { internalType: "uint32", name: "_gracePeriod", type: "uint32" }
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_idCommitment", type: "uint256" }
    ],
    name: "isExpired",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_idCommitment", type: "uint256" }
    ],
    name: "isInGracePeriod",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "isInMembershipSet",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "isValidIdCommitment",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint32", name: "rateLimit", type: "uint32" }],
    name: "isValidMembershipRateLimit",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "maxMembershipRateLimit",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "maxTotalRateLimit",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "_idCommitment", type: "uint256" }
    ],
    name: "membershipExpirationTimestamp",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" }
    ],
    name: "memberships",
    outputs: [
      { internalType: "uint256", name: "depositAmount", type: "uint256" },
      { internalType: "uint32", name: "activeDuration", type: "uint32" },
      {
        internalType: "uint256",
        name: "gracePeriodStartTimestamp",
        type: "uint256"
      },
      { internalType: "uint32", name: "gracePeriodDuration", type: "uint32" },
      { internalType: "uint32", name: "rateLimit", type: "uint32" },
      { internalType: "uint32", name: "index", type: "uint32" },
      { internalType: "address", name: "holder", type: "address" },
      { internalType: "address", name: "token", type: "address" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "merkleTree",
    outputs: [
      { internalType: "uint40", name: "maxIndex", type: "uint40" },
      { internalType: "uint40", name: "numberOfLeaves", type: "uint40" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "minMembershipRateLimit",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "nextFreeIndex",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "priceCalculator",
    outputs: [
      { internalType: "contract IPriceCalculator", name: "", type: "address" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "proxiableUUID",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "idCommitment", type: "uint256" },
      { internalType: "uint32", name: "rateLimit", type: "uint32" },
      {
        internalType: "uint256[]",
        name: "idCommitmentsToErase",
        type: "uint256[]"
      }
    ],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint8", name: "v", type: "uint8" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "s", type: "bytes32" },
      { internalType: "uint256", name: "idCommitment", type: "uint256" },
      { internalType: "uint32", name: "rateLimit", type: "uint32" },
      {
        internalType: "uint256[]",
        name: "idCommitmentsToErase",
        type: "uint256[]"
      }
    ],
    name: "registerWithPermit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "root",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "_activeDurationForNewMembership",
        type: "uint32"
      }
    ],
    name: "setActiveDuration",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "_gracePeriodDurationForNewMembership",
        type: "uint32"
      }
    ],
    name: "setGracePeriodDuration",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "_maxMembershipRateLimit",
        type: "uint32"
      }
    ],
    name: "setMaxMembershipRateLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint32", name: "_maxTotalRateLimit", type: "uint32" }
    ],
    name: "setMaxTotalRateLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint32",
        name: "_minMembershipRateLimit",
        type: "uint32"
      }
    ],
    name: "setMinMembershipRateLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "_priceCalculator", type: "address" }
    ],
    name: "setPriceCalculator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "newImplementation", type: "address" }
    ],
    name: "upgradeTo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "newImplementation", type: "address" },
      { internalType: "bytes", name: "data", type: "bytes" }
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];
