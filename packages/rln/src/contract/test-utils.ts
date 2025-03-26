import { hexToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import * as ethers from "ethers";
import sinon from "sinon";

import type { IdentityCredential } from "../identity.js";

import { DEFAULT_RATE_LIMIT, SEPOLIA_CONTRACT } from "./constants.js";

export const mockRateLimits = {
  minRate: 20,
  maxRate: 600,
  maxTotalRate: 1200,
  currentTotalRate: 500
};

type MockProvider = {
  getLogs: () => never[];
  getBlockNumber: () => Promise<number>;
  getNetwork: () => Promise<{ chainId: number }>;
};

type MockFilters = {
  MembershipRegistered: () => { address: string };
  MembershipErased: () => { address: string };
  MembershipExpired: () => { address: string };
};

export function createMockProvider(): MockProvider {
  return {
    getLogs: () => [],
    getBlockNumber: () => Promise.resolve(1000),
    getNetwork: () => Promise.resolve({ chainId: 11155111 })
  };
}

export function createMockFilters(): MockFilters {
  return {
    MembershipRegistered: () => ({ address: SEPOLIA_CONTRACT.address }),
    MembershipErased: () => ({ address: SEPOLIA_CONTRACT.address }),
    MembershipExpired: () => ({ address: SEPOLIA_CONTRACT.address })
  };
}

type ContractOverrides = Partial<{
  filters: Record<string, unknown>;
  [key: string]: unknown;
}>;

export function createMockRegistryContract(
  overrides: ContractOverrides = {}
): ethers.Contract {
  const filters = {
    MembershipRegistered: () => ({ address: SEPOLIA_CONTRACT.address }),
    MembershipErased: () => ({ address: SEPOLIA_CONTRACT.address }),
    MembershipExpired: () => ({ address: SEPOLIA_CONTRACT.address })
  };

  const baseContract = {
    minMembershipRateLimit: () =>
      Promise.resolve(ethers.BigNumber.from(mockRateLimits.minRate)),
    maxMembershipRateLimit: () =>
      Promise.resolve(ethers.BigNumber.from(mockRateLimits.maxRate)),
    maxTotalRateLimit: () =>
      Promise.resolve(ethers.BigNumber.from(mockRateLimits.maxTotalRate)),
    currentTotalRateLimit: () =>
      Promise.resolve(ethers.BigNumber.from(mockRateLimits.currentTotalRate)),
    queryFilter: () => [],
    provider: createMockProvider(),
    filters,
    on: () => ({}),
    removeAllListeners: () => ({}),
    register: () => ({
      wait: () =>
        Promise.resolve({
          events: [mockRLNRegisteredEvent()]
        })
    }),
    estimateGas: {
      register: () => Promise.resolve(ethers.BigNumber.from(100000))
    },
    functions: {
      register: () => Promise.resolve()
    },
    getMemberIndex: () => Promise.resolve(null),
    interface: {
      getEvent: (eventName: string) => ({
        name: eventName,
        format: () => {}
      })
    },
    address: SEPOLIA_CONTRACT.address
  };

  // Merge overrides while preserving filters
  const merged = {
    ...baseContract,
    ...overrides,
    filters: { ...filters, ...(overrides.filters || {}) }
  };

  return merged as unknown as ethers.Contract;
}

export function mockRLNRegisteredEvent(idCommitment?: string): ethers.Event {
  return {
    args: {
      idCommitment:
        idCommitment ||
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      membershipRateLimit: ethers.BigNumber.from(DEFAULT_RATE_LIMIT),
      index: ethers.BigNumber.from(1)
    },
    event: "MembershipRegistered"
  } as unknown as ethers.Event;
}

export function formatIdCommitment(idCommitmentBigInt: bigint): string {
  return "0x" + idCommitmentBigInt.toString(16).padStart(64, "0");
}

export function createRegisterStub(
  identity: IdentityCredential
): sinon.SinonStub {
  return sinon.stub().callsFake(() => ({
    wait: () =>
      Promise.resolve({
        events: [
          {
            event: "MembershipRegistered",
            args: {
              idCommitment: formatIdCommitment(identity.IDCommitmentBigInt),
              rateLimit: DEFAULT_RATE_LIMIT,
              index: ethers.BigNumber.from(1)
            }
          }
        ]
      })
  }));
}

export function verifyRegistration(
  decryptedCredentials: any,
  identity: IdentityCredential,
  registerStub: sinon.SinonStub,
  insertMemberSpy: sinon.SinonStub
): void {
  if (!decryptedCredentials) {
    throw new Error("Decrypted credentials should not be undefined");
  }

  // Verify registration call
  expect(
    registerStub.calledWith(
      sinon.match.same(identity.IDCommitmentBigInt),
      sinon.match.same(DEFAULT_RATE_LIMIT),
      sinon.match.array,
      sinon.match.object
    )
  ).to.be.true;

  // Verify credential properties
  expect(decryptedCredentials).to.have.property("identity");
  expect(decryptedCredentials).to.have.property("membership");
  expect(decryptedCredentials.membership).to.include({
    address: SEPOLIA_CONTRACT.address,
    treeIndex: 1
  });

  // Verify member insertion
  const expectedIdCommitment = ethers.utils.zeroPad(
    hexToBytes(formatIdCommitment(identity.IDCommitmentBigInt)),
    32
  );
  expect(insertMemberSpy.callCount).to.equal(1);
  expect(insertMemberSpy.getCall(0).args[0]).to.deep.equal(
    expectedIdCommitment
  );
}
