import { expect } from "chai";
import { type Address, createPublicClient, http } from "viem";
import { lineaSepolia } from "viem/chains";

import { Keystore } from "../keystore/index.js";
import { RLNInstance } from "../rln.js";
import { BytesUtils } from "../utils/index.js";
import {
  calculateRateCommitment,
  extractPathDirectionsFromProof,
  MERKLE_TREE_DEPTH,
  reconstructMerkleRoot
} from "../utils/merkle.js";
import { TEST_KEYSTORE_DATA } from "../utils/test_keystore.js";

import { RLN_CONTRACT } from "./constants.js";
import { RLNBaseContract } from "./rln_base_contract.js";

describe("RLN Proof Integration Tests", function () {
  this.timeout(30000);

  let rpcUrl: string;

  before(async function () {
    this.timeout(10000); // Allow time for WASM initialization

    // Initialize WASM module before running tests
    await RLNInstance.create();

    rpcUrl = process.env.RPC_URL || "https://rpc.sepolia.linea.build";

    if (!rpcUrl) {
      console.log(
        "Skipping integration tests - RPC_URL environment variable not set"
      );
      console.log(
        "To run these tests, set RPC_URL to a Linea Sepolia RPC endpoint"
      );
      this.skip();
    }
  });

  it("get merkle proof from contract, construct rln proof, verify rln proof", async function () {
    // Load the test keystore from constant (browser-compatible)
    const keystore = Keystore.fromString(TEST_KEYSTORE_DATA.keystoreJson);
    if (!keystore) {
      throw new Error("Failed to load test keystore");
    }

    // Use the known credential hash and password from the test data
    const credentialHash = TEST_KEYSTORE_DATA.credentialHash;
    const password = TEST_KEYSTORE_DATA.password;
    console.log(`Using credential hash: ${credentialHash}`);
    const credential = await keystore.readCredential(credentialHash, password);
    if (!credential) {
      throw new Error("Failed to unlock credential with provided password");
    }

    // Extract the ID commitment from the credential
    const idCommitment = credential.identity.IDCommitmentBigInt;
    console.log(`ID Commitment from keystore: ${idCommitment.toString()}`);

    const publicClient = createPublicClient({
      chain: lineaSepolia,
      transport: http(rpcUrl)
    });

    const dummyWalletClient = createPublicClient({
      chain: lineaSepolia,
      transport: http(rpcUrl)
    }) as any;

    const contract = await RLNBaseContract.create({
      address: RLN_CONTRACT.address as Address,
      publicClient,
      walletClient: dummyWalletClient
    });

    // First, get membership info to find the index
    const membershipInfo = await contract.getMembershipInfo(idCommitment);

    if (!membershipInfo) {
      console.log(
        `ID commitment ${idCommitment.toString()} not found in membership set`
      );
      this.skip();
      return;
    }

    console.log(`Found membership at index: ${membershipInfo.index}`);
    console.log(`Membership state: ${membershipInfo.state}`);

    // Get the merkle proof for this member's index
    const merkleProof = await contract.getMerkleProof(membershipInfo.index);

    expect(merkleProof).to.be.an("array");
    expect(merkleProof).to.have.lengthOf(MERKLE_TREE_DEPTH); // RLN uses fixed depth merkle tree

    console.log(`Merkle proof for ID commitment ${idCommitment.toString()}:`);
    console.log(`Index: ${membershipInfo.index}`);
    console.log(`Proof elements (${merkleProof.length}):`);
    merkleProof.forEach((element, i) => {
      console.log(
        `  [${i}]: ${element.toString()} (0x${element.toString(16)})`
      );
    });

    // Verify all proof elements are valid bigints
    merkleProof.forEach((element, i) => {
      expect(element).to.be.a(
        "bigint",
        `Proof element ${i} should be a bigint`
      );
      expect(element).to.not.equal(0n, `Proof element ${i} should not be zero`);
    });
  });

  it.only("should generate a valid RLN proof", async function () {
    const publicClient = createPublicClient({
      chain: lineaSepolia,
      transport: http(rpcUrl)
    });

    const dummyWalletClient = createPublicClient({
      chain: lineaSepolia,
      transport: http(rpcUrl)
    }) as any;

    const contract = await RLNBaseContract.create({
      address: RLN_CONTRACT.address as Address,
      publicClient,
      walletClient: dummyWalletClient
    });
    // get credential from keystore
    const keystore = Keystore.fromString(TEST_KEYSTORE_DATA.keystoreJson);
    if (!keystore) {
      throw new Error("Failed to load test keystore");
    }
    const credentialHash = TEST_KEYSTORE_DATA.credentialHash;
    const password = TEST_KEYSTORE_DATA.password;
    const credential = await keystore.readCredential(credentialHash, password);
    if (!credential) {
      throw new Error("Failed to unlock credential with provided password");
    }
    const idCommitment = credential.identity.IDCommitmentBigInt;
    const membershipInfo = await contract.getMembershipInfo(idCommitment);
    if (!membershipInfo) {
      throw new Error("Failed to get membership info");
    }
    const rateLimit = BigInt(membershipInfo.rateLimit);

    const merkleProof = await contract.getMerkleProof(membershipInfo.index);
    const merkleRoot = await contract.getMerkleRoot();
    const rateCommitment = calculateRateCommitment(idCommitment, rateLimit);

    // Get the array of indexes that correspond to each proof element
    const proofElementIndexes = extractPathDirectionsFromProof(
      merkleProof,
      rateCommitment,
      merkleRoot
    );
    if (!proofElementIndexes) {
      throw new Error("Failed to extract proof element indexes");
    }

    // Verify the array has the correct length
    expect(proofElementIndexes).to.have.lengthOf(MERKLE_TREE_DEPTH);

    // Verify that we can reconstruct the root using these indexes
    const reconstructedRoot = reconstructMerkleRoot(
      merkleProof as bigint[],
      BigInt(membershipInfo.index),
      rateCommitment
    );

    expect(reconstructedRoot).to.equal(
      merkleRoot,
      "Reconstructed root should match contract root"
    );

    const testMessage = new TextEncoder().encode("test");
    const rlnInstance = await RLNInstance.create();

    const proof = await rlnInstance.zerokit.generateRLNProof(
      testMessage,
      membershipInfo.index,
      new Date(),
      credential.identity.IDSecretHash,
      merkleProof.map((proof) => BytesUtils.fromBigInt(proof, 32, "little")),
      proofElementIndexes.map((index) =>
        BytesUtils.writeUIntLE(new Uint8Array(1), index, 0, 1)
      ),
      Number(rateLimit),
      0
    );

    const isValid = rlnInstance.zerokit.verifyRLNProof(
      BytesUtils.writeUIntLE(new Uint8Array(8), testMessage.length, 0, 8),
      testMessage,
      proof,
      [BytesUtils.fromBigInt(merkleRoot, 32, "little")]
    );
    expect(isValid).to.be.true;
  });
});
