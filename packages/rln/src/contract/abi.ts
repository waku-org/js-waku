export const RLN_ABI = [
  {
    type: "constructor",
    inputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "error",
    name: "DuplicateIdCommitment",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidIdCommitment",
    inputs: [
      {
        name: "idCommitment",
        type: "uint256"
      }
    ]
  },
  {
    type: "error",
    name: "InvalidPaginationQuery",
    inputs: [
      {
        name: "startIndex",
        type: "uint256"
      },
      {
        name: "endIndex",
        type: "uint256"
      }
    ]
  },
  {
    type: "function",
    name: "MAX_MEMBERSHIP_SET_SIZE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "MERKLE_TREE_DEPTH",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint8"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "Q",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "activeDurationForNewMemberships",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "currentTotalRateLimit",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "deployedBlockNumber",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "depositsToWithdraw",
    inputs: [
      {
        name: "holder",
        type: "address"
      },
      {
        name: "token",
        type: "address"
      }
    ],
    outputs: [
      {
        name: "balance",
        type: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "eraseMemberships",
    inputs: [
      {
        name: "idCommitments",
        type: "uint256[]"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "eraseMemberships",
    inputs: [
      {
        name: "idCommitments",
        type: "uint256[]"
      },
      {
        name: "eraseFromMembershipSet",
        type: "bool"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "extendMemberships",
    inputs: [
      {
        name: "idCommitments",
        type: "uint256[]"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getMembershipInfo",
    inputs: [
      {
        name: "idCommitment",
        type: "uint256"
      }
    ],
    outputs: [
      {
        name: "",
        type: "uint32"
      },
      {
        name: "",
        type: "uint32"
      },
      {
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getMerkleProof",
    inputs: [
      {
        name: "index",
        type: "uint40"
      }
    ],
    outputs: [
      {
        name: "",
        type: "uint256[20]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getRateCommitmentsInRangeBoundsInclusive",
    inputs: [
      {
        name: "startIndex",
        type: "uint32"
      },
      {
        name: "endIndex",
        type: "uint32"
      }
    ],
    outputs: [
      {
        name: "",
        type: "uint256[]"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "gracePeriodDurationForNewMemberships",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint32"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "initialize",
    inputs: [
      {
        name: "_priceCalculator",
        type: "address"
      },
      {
        name: "_maxTotalRateLimit",
        type: "uint32"
      },
      {
        name: "_minMembershipRateLimit",
        type: "uint32"
      },
      {
        name: "_maxMembershipRateLimit",
        type: "uint32"
      },
      {
        name: "_activeDuration",
        type: "uint32"
      },
      {
        name: "_gracePeriod",
        type: "uint32"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "isExpired",
    inputs: [
      {
        name: "_idCommitment",
        type: "uint256"
      }
    ],
    outputs: [
      {
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "register",
    inputs: [
      {
        name: "idCommitment",
        type: "uint256"
      },
      {
        name: "rateLimit",
        type: "uint32"
      },
      {
        name: "idCommitmentsToErase",
        type: "uint256[]"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "registerWithPermit",
    inputs: [
      {
        name: "owner",
        type: "address"
      },
      {
        name: "deadline",
        type: "uint256"
      },
      {
        name: "v",
        type: "uint8"
      },
      {
        name: "r",
        type: "bytes32"
      },
      {
        name: "s",
        type: "bytes32"
      },
      {
        name: "idCommitment",
        type: "uint256"
      },
      {
        name: "rateLimit",
        type: "uint32"
      },
      {
        name: "idCommitmentsToErase",
        type: "uint256[]"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "MembershipRegistered",
    inputs: [
      {
        name: "idCommitment",
        type: "uint256",
        indexed: false
      },
      {
        name: "rateLimit",
        type: "uint32",
        indexed: false
      },
      {
        name: "index",
        type: "uint256",
        indexed: false
      }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "MembershipRemoved",
    inputs: [
      {
        name: "idCommitment",
        type: "uint256",
        indexed: false
      },
      {
        name: "index",
        type: "uint256",
        indexed: false
      }
    ],
    anonymous: false
  }
];
