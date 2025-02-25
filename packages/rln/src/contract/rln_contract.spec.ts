import { expect } from "chai";
import * as ethers from "ethers";

import { createRLN } from "../create.js";

import { SEPOLIA_CONTRACT } from "./constants.js";
import { RLNContract } from "./rln_contract.js";

describe("RLN Contract abstraction", () => {
  it("should be able to fetch members from events and store to rln instance", async () => {
    const rlnInstance = await createRLN();
    let insertMemberCalled = false;

    // Track if insertMember was called
    const originalInsertMember = rlnInstance.zerokit.insertMember;
    rlnInstance.zerokit.insertMember = function (
      this: any,
      ...args: Parameters<typeof originalInsertMember>
    ) {
      insertMemberCalled = true;
      return originalInsertMember.apply(this, args);
    };

    const voidSigner = new ethers.VoidSigner(SEPOLIA_CONTRACT.address);
    const rlnContract = new RLNContract(rlnInstance, {
      registryAddress: SEPOLIA_CONTRACT.address,
      signer: voidSigner
    });

    rlnContract["storageContract"] = {
      queryFilter: () => Promise.resolve([mockEvent()])
    } as unknown as ethers.Contract;
    rlnContract["_membersFilter"] = {
      address: "",
      topics: []
    } as unknown as ethers.EventFilter;

    await rlnContract.fetchMembers(rlnInstance);

    expect(insertMemberCalled).to.be.true;
  });

  it("should register a member", async () => {
    const mockSignature =
      "0xdeb8a6b00a8e404deb1f52d3aa72ed7f60a2ff4484c737eedaef18a0aacb2dfb4d5d74ac39bb71fa358cf2eb390565a35b026cc6272f2010d4351e17670311c21c";

    const rlnInstance = await createRLN();
    const voidSigner = new ethers.VoidSigner(SEPOLIA_CONTRACT.address);
    const rlnContract = new RLNContract(rlnInstance, {
      registryAddress: SEPOLIA_CONTRACT.address,
      signer: voidSigner
    });

    let registerCalled = false;
    rlnContract["storageIndex"] = 1;
    rlnContract["_membersFilter"] = {
      address: "",
      topics: []
    } as unknown as ethers.EventFilter;
    rlnContract["registryContract"] = {
      "register(uint16,uint256)": () => {
        registerCalled = true;
        return Promise.resolve({ wait: () => Promise.resolve(undefined) });
      }
    } as unknown as ethers.Contract;

    const identity =
      rlnInstance.zerokit.generateSeededIdentityCredential(mockSignature);
    await rlnContract.registerWithIdentity(identity);

    expect(registerCalled).to.be.true;
  });
});

function mockEvent(): ethers.Event {
  return {
    args: {
      idCommitment: { _hex: "0xb3df1c4e5600ef2b" },
      index: ethers.BigNumber.from(1)
    }
  } as unknown as ethers.Event;
}
