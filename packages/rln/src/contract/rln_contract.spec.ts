import { hexToBytes } from "@waku/utils/bytes";
import chai from "chai";
import spies from "chai-spies";
import * as ethers from "ethers";
import sinon, { SinonSandbox } from "sinon";

import { createRLN } from "../create.js";
import type { IdentityCredential } from "../identity.js";

import { SEPOLIA_CONTRACT } from "./constants.js";
import { RLNContract } from "./rln_contract.js";

chai.use(spies);

const DEFAULT_RATE_LIMIT = 10;

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

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should fetch members from events and store them in the RLN instance", async () => {
    const rlnInstance = await createRLN();

    rlnInstance.zerokit.insertMember = () => undefined;
    const insertMemberSpy = chai.spy.on(rlnInstance.zerokit, "insertMember");

    const membershipRegisteredEvent = mockRLNv2RegisteredEvent();
    const mockedRegistryContract = {
      queryFilter: () => [membershipRegisteredEvent],
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

    const queryFilterSpy = chai.spy.on(mockedRegistryContract, "queryFilter");

    const provider = new ethers.providers.JsonRpcProvider();
    const voidSigner = new ethers.VoidSigner(
      SEPOLIA_CONTRACT.address,
      provider
    );
    const rlnContract = await RLNContract.init(rlnInstance, {
      address: SEPOLIA_CONTRACT.address,
      signer: voidSigner,
      rateLimit: 0,
      contract: mockedRegistryContract as unknown as ethers.Contract
    });

    await rlnContract.fetchMembers(rlnInstance, {
      fromBlock: 0,
      fetchRange: 1000,
      fetchChunks: 2
    });

    chai
      .expect(insertMemberSpy)
      .to.have.been.called.with(
        ethers.utils.zeroPad(
          hexToBytes(membershipRegisteredEvent.args!.idCommitment),
          32
        )
      );

    chai.expect(queryFilterSpy).to.have.been.called;
  });

  it("should register a member", async () => {
    const mockSignature =
      "0xdeb8a6b00a8e404deb1f52d3aa72ed7f60a2ff4484c737eedaef18a0aacb2dfb4d5d74ac39bb71fa358cf2eb390565a35b026cc6272f2010d4351e17670311c21c";

    const rlnInstance = await createRLN();
    const identity: IdentityCredential =
      rlnInstance.zerokit.generateSeededIdentityCredential(mockSignature);

    rlnInstance.zerokit.insertMember = () => undefined;
    const insertMemberSpy = chai.spy.on(rlnInstance.zerokit, "insertMember");

    const formatIdCommitment = (idCommitmentBigInt: bigint): string =>
      "0x" + idCommitmentBigInt.toString(16).padStart(64, "0");

    const membershipRegisteredEvent = mockRLNv2RegisteredEvent(
      formatIdCommitment(identity.IDCommitmentBigInt)
    );

    const mockedRegistryContract = {
      register: () => ({
        wait: () =>
          Promise.resolve({
            events: [
              {
                event: "MembershipRegistered",
                args: {
                  idCommitment: formatIdCommitment(identity.IDCommitmentBigInt),
                  rateLimit: 0,
                  index: ethers.BigNumber.from(1)
                }
              }
            ]
          })
      }),
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
      rateLimit: 0,
      contract: mockedRegistryContract as unknown as ethers.Contract
    });

    const registerSpy = chai.spy.on(mockedRegistryContract, "register");

    const decryptedCredentials =
      await rlnContract.registerWithIdentity(identity);

    chai.expect(decryptedCredentials).to.not.be.undefined;
    if (!decryptedCredentials)
      throw new Error("Decrypted credentials should not be undefined");

    chai
      .expect(registerSpy)
      .to.have.been.called.with(identity.IDCommitmentBigInt, 0, [], {
        gasLimit: 300000
      });

    chai.expect(decryptedCredentials).to.have.property("identity");
    chai.expect(decryptedCredentials).to.have.property("membership");
    chai.expect(decryptedCredentials.membership).to.include({
      address: SEPOLIA_CONTRACT.address,
      treeIndex: 1
    });

    const expectedIdCommitment = ethers.utils.zeroPad(
      hexToBytes(formatIdCommitment(identity.IDCommitmentBigInt)),
      32
    );
    const insertMemberCalls = (insertMemberSpy as any).__spy.calls;
    chai.expect(insertMemberCalls).to.have.length(2);
    chai.expect(insertMemberCalls[1][0]).to.deep.equal(expectedIdCommitment);
  });
});
