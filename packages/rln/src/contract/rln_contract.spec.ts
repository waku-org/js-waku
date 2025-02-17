import { hexToBytes } from "@waku/utils/bytes";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import * as ethers from "ethers";
import sinon, { SinonSandbox } from "sinon";

import { createRLN } from "../create.js";
import type { IdentityCredential } from "../identity.js";

import { SEPOLIA_CONTRACT } from "./constants.js";
import { RLNContract } from "./rln_contract.js";

use(chaiAsPromised);

// Use the minimum allowed rate limit from RATE_LIMIT_TIERS
const DEFAULT_RATE_LIMIT = 20;

function mockRLNv2RegisteredEvent(idCommitment?: string): ethers.Event {
  return {
    args: {
      idCommitment:
        idCommitment ||
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      rateLimit: DEFAULT_RATE_LIMIT,
      index: ethers.BigNumber.from(1)
    },
    event: "MembershipRegistered"
  } as unknown as ethers.Event;
}

describe("RLN Contract abstraction - RLN v2", () => {
  let sandbox: SinonSandbox;
  let rlnInstance: any;
  let mockedRegistryContract: any;
  let rlnContract: RLNContract;

  const mockRateLimits = {
    minRate: 20,
    maxRate: 600,
    maxTotalRate: 1000,
    currentTotalRate: 500
  };

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    rlnInstance = await createRLN();
    rlnInstance.zerokit.insertMember = () => undefined;

    mockedRegistryContract = {
      minMembershipRateLimit: () =>
        Promise.resolve(ethers.BigNumber.from(mockRateLimits.minRate)),
      maxMembershipRateLimit: () =>
        Promise.resolve(ethers.BigNumber.from(mockRateLimits.maxRate)),
      maxTotalRateLimit: () =>
        Promise.resolve(ethers.BigNumber.from(mockRateLimits.maxTotalRate)),
      currentTotalRateLimit: () =>
        Promise.resolve(ethers.BigNumber.from(mockRateLimits.currentTotalRate)),
      queryFilter: () => [mockRLNv2RegisteredEvent()],
      provider: {
        getLogs: () => [],
        getBlockNumber: () => Promise.resolve(1000),
        getNetwork: () => Promise.resolve({ chainId: 11155111 })
      },
      filters: {
        MembershipRegistered: () => ({}),
        MembershipRemoved: () => ({})
      },
      on: () => ({})
    };

    const provider = new ethers.providers.JsonRpcProvider();
    const voidSigner = new ethers.VoidSigner(
      SEPOLIA_CONTRACT.address,
      provider
    );
    rlnContract = await RLNContract.init(rlnInstance, {
      address: SEPOLIA_CONTRACT.address,
      signer: voidSigner,
      rateLimit: DEFAULT_RATE_LIMIT,
      contract: mockedRegistryContract as unknown as ethers.Contract
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("Rate Limit Management", () => {
    it("should get contract rate limit parameters", async () => {
      const minRate = await rlnContract.getMinRateLimit();
      const maxRate = await rlnContract.getMaxRateLimit();
      const maxTotal = await rlnContract.getMaxTotalRateLimit();
      const currentTotal = await rlnContract.getCurrentTotalRateLimit();

      expect(minRate).to.equal(mockRateLimits.minRate);
      expect(maxRate).to.equal(mockRateLimits.maxRate);
      expect(maxTotal).to.equal(mockRateLimits.maxTotalRate);
      expect(currentTotal).to.equal(mockRateLimits.currentTotalRate);
    });

    it("should calculate remaining total rate limit", async () => {
      const remaining = await rlnContract.getRemainingTotalRateLimit();
      expect(remaining).to.equal(
        mockRateLimits.maxTotalRate - mockRateLimits.currentTotalRate
      );
    });

    it("should set rate limit", async () => {
      const newRate = 300; // Any value, since validation is done by contract
      await rlnContract.setRateLimit(newRate);
      expect(rlnContract.getRateLimit()).to.equal(newRate);
    });
  });

  it("should fetch members from events and store them in the RLN instance", async () => {
    const rlnInstance = await createRLN();

    const insertMemberSpy = sinon.stub();
    rlnInstance.zerokit.insertMember = insertMemberSpy;

    const membershipRegisteredEvent = mockRLNv2RegisteredEvent();

    const queryFilterStub = sinon.stub().returns([membershipRegisteredEvent]);
    const mockedRegistryContract = {
      queryFilter: queryFilterStub,
      provider: {
        getLogs: () => [],
        getBlockNumber: () => Promise.resolve(1000)
      },
      interface: {
        getEvent: (eventName: string) => ({
          name: eventName,
          format: () => {}
        })
      },
      filters: {
        MembershipRegistered: () => ({}),
        MembershipRemoved: () => ({})
      },
      on: () => ({}),
      removeAllListeners: () => ({})
    };

    const provider = new ethers.providers.JsonRpcProvider();
    const voidSigner = new ethers.VoidSigner(
      SEPOLIA_CONTRACT.address,
      provider
    );
    const rlnContract = await RLNContract.init(rlnInstance, {
      address: SEPOLIA_CONTRACT.address,
      signer: voidSigner,
      rateLimit: DEFAULT_RATE_LIMIT,
      contract: mockedRegistryContract as unknown as ethers.Contract
    });

    await rlnContract.fetchMembers(rlnInstance, {
      fromBlock: 0,
      fetchRange: 1000,
      fetchChunks: 2
    });

    expect(
      insertMemberSpy.calledWith(
        ethers.utils.zeroPad(
          hexToBytes(membershipRegisteredEvent.args!.idCommitment),
          32
        )
      )
    ).to.be.true;

    expect(queryFilterStub.called).to.be.true;
  });

  it("should register a member", async () => {
    const mockSignature =
      "0xdeb8a6b00a8e404deb1f52d3aa72ed7f60a2ff4484c737eedaef18a0aacb2dfb4d5d74ac39bb71fa358cf2eb390565a35b026cc6272f2010d4351e17670311c21c";

    const rlnInstance = await createRLN();
    const identity: IdentityCredential =
      rlnInstance.zerokit.generateSeededIdentityCredential(mockSignature);

    const insertMemberSpy = sinon.stub();
    rlnInstance.zerokit.insertMember = insertMemberSpy;

    const formatIdCommitment = (idCommitmentBigInt: bigint): string =>
      "0x" + idCommitmentBigInt.toString(16).padStart(64, "0");

    const membershipRegisteredEvent = mockRLNv2RegisteredEvent(
      formatIdCommitment(identity.IDCommitmentBigInt)
    );

    const registerStub = sinon.stub().returns({
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
    });

    const mockedRegistryContract = {
      register: registerStub,
      queryFilter: () => [membershipRegisteredEvent],
      provider: {
        getLogs: () => [],
        getBlockNumber: () => Promise.resolve(1000),
        getNetwork: () => Promise.resolve({ chainId: 11155111 })
      },
      address: SEPOLIA_CONTRACT.address,
      interface: {
        getEvent: (eventName: string) => ({
          name: eventName,
          format: () => {}
        })
      },
      filters: {
        MembershipRegistered: () => ({}),
        MembershipRemoved: () => ({})
      },
      on: () => ({}),
      removeAllListeners: () => ({})
    };

    const provider = new ethers.providers.JsonRpcProvider();
    const voidSigner = new ethers.VoidSigner(
      SEPOLIA_CONTRACT.address,
      provider
    );
    const rlnContract = await RLNContract.init(rlnInstance, {
      signer: voidSigner,
      address: SEPOLIA_CONTRACT.address,
      rateLimit: DEFAULT_RATE_LIMIT,
      contract: mockedRegistryContract as unknown as ethers.Contract
    });

    const decryptedCredentials =
      await rlnContract.registerWithIdentity(identity);

    expect(decryptedCredentials).to.not.be.undefined;
    if (!decryptedCredentials)
      throw new Error("Decrypted credentials should not be undefined");

    expect(
      registerStub.calledWith(
        identity.IDCommitmentBigInt,
        DEFAULT_RATE_LIMIT,
        [],
        {
          gasLimit: 300000
        }
      )
    ).to.be.true;

    expect(decryptedCredentials).to.have.property("identity");
    expect(decryptedCredentials).to.have.property("membership");
    expect(decryptedCredentials.membership).to.include({
      address: SEPOLIA_CONTRACT.address,
      treeIndex: 1
    });

    const expectedIdCommitment = ethers.utils.zeroPad(
      hexToBytes(formatIdCommitment(identity.IDCommitmentBigInt)),
      32
    );
    expect(insertMemberSpy.callCount).to.equal(2);
    expect(insertMemberSpy.getCall(1).args[0]).to.deep.equal(
      expectedIdCommitment
    );
  });
});
