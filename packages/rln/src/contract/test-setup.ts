import { hexToBytes } from "@waku/utils/bytes";
import { ethers } from "ethers";
import sinon from "sinon";

import { createRLN } from "../create.js";
import type { IdentityCredential } from "../identity.js";

import { DEFAULT_RATE_LIMIT, SEPOLIA_CONTRACT } from "./constants.js";
import { RLNContract } from "./rln_contract.js";

export interface TestRLNInstance {
  rlnInstance: any;
  identity: IdentityCredential;
  insertMemberSpy: sinon.SinonStub;
}

/**
 * Creates a test RLN instance with basic setup
 */
export async function createTestRLNInstance(): Promise<TestRLNInstance> {
  const rlnInstance = await createRLN();
  const insertMemberSpy = sinon.stub();
  rlnInstance.zerokit.insertMember = insertMemberSpy;

  const mockSignature =
    "0xdeb8a6b00a8e404deb1f52d3aa72ed7f60a2ff4484c737eedaef18a0aacb2dfb4d5d74ac39bb71fa358cf2eb390565a35b026cc6272f2010d4351e17670311c21c";
  const identity =
    rlnInstance.zerokit.generateSeededIdentityCredential(mockSignature);

  return {
    rlnInstance,
    identity,
    insertMemberSpy
  };
}

/**
 * Initializes an RLN contract with the given registry contract
 */
export async function initializeRLNContract(
  rlnInstance: any,
  mockedRegistryContract: ethers.Contract
): Promise<RLNContract> {
  const provider = new ethers.providers.JsonRpcProvider();
  const voidSigner = new ethers.VoidSigner(SEPOLIA_CONTRACT.address, provider);

  const originalRegister = mockedRegistryContract.register;
  (mockedRegistryContract as any).register = function (...args: any[]) {
    const result = originalRegister.apply(this, args);

    if (args[0] && rlnInstance.zerokit) {
      const idCommitmentBigInt = args[0];
      const idCommitmentHex =
        "0x" + idCommitmentBigInt.toString(16).padStart(64, "0");
      const idCommitment = ethers.utils.zeroPad(
        hexToBytes(idCommitmentHex),
        32
      );
      rlnInstance.zerokit.insertMember(idCommitment);
    }

    return result;
  };

  const contract = await RLNContract.init(rlnInstance, {
    address: SEPOLIA_CONTRACT.address,
    signer: voidSigner,
    rateLimit: DEFAULT_RATE_LIMIT,
    contract: mockedRegistryContract
  });

  return contract;
}

/**
 * Common test message data
 */
export const TEST_DATA = {
  contentTopic: "/test/1/waku-message/utf8",
  emptyPubsubTopic: "",
  testMessage: Uint8Array.from(
    "Hello World".split("").map((x) => x.charCodeAt(0))
  ),
  mockSignature:
    "0xdeb8a6b00a8e404deb1f52d3aa72ed7f60a2ff4484c737eedaef18a0aacb2dfb4d5d74ac39bb71fa358cf2eb390565a35b026cc6272f2010d4351e17670311c21c"
} as const;
