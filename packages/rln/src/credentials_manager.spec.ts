import { expect } from "chai";

import { RLNCredentialsManager } from "./credentials_manager.js";
import type { IdentityCredential } from "./identity.js";

/**
 * Reproduces the seeded_extended_keygen test vector from the Rust RLN library.
 *
 * The vector starts with the raw byte sequence 0..=9. The resulting
 * trapdoor, nullifier, secret-hash and commitment are checked against the
 * expected field elements.
 */

describe("RLN seeded_extended_keygen vector", function () {
  this.timeout(10_000);

  it("should reproduce the Rust reference values", async function () {
    // Seed bytes 0..=9 as in the Rust test
    const seedBytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Generate a string whose UTF-8 encoding equals the seed bytes. We build
    // it from raw char codes so that TextEncoder returns the exact same array.
    const seedStr = String.fromCharCode(...seedBytes);

    const mgr = new RLNCredentialsManager();
    const cred: IdentityCredential = await (
      mgr as any
    ).generateSeededIdentityCredential(seedStr);

    const toBigIntBE = (bytes: Uint8Array): bigint => {
      let res = 0n;
      for (let i = 0; i < bytes.length; i++) {
        res = (res << 8n) + BigInt(bytes[i]);
      }
      return res;
    };

    // Read the credentials as big-endian since IdentityCredential stores them that way
    const trapdoor = toBigIntBE(cred.IDTrapdoor);
    const nullifier = toBigIntBE(cred.IDNullifier);
    const secretHash = toBigIntBE(cred.IDSecretHash);
    const commitment = toBigIntBE(cred.IDCommitment);

    console.log(trapdoor);

    // Expected constants taken from the Rust vector
    const expTrapdoor = BigInt(
      "0x766ce6c7e7a01bdf5b3f257616f603918c30946fa23480f2859c597817e6716"
    );
    console.log("trapdoor", trapdoor);
    console.log("expTrapdoor", expTrapdoor);
    console.log("trapdoor === expTrapdoor", trapdoor === expTrapdoor);
    const expNullifier = BigInt(
      "0x1f18714c7bc83b5bca9e89d404cf6f2f585bc4c0f7ed8b53742b7e2b298f50b4"
    );
    const expSecretHash = BigInt(
      "0x2aca62aaa7abaf3686fff2caf00f55ab9462dc12db5b5d4bcf3994e671f8e521"
    );
    const expCommitment = BigInt(
      "0x68b66aa0a8320d2e56842581553285393188714c48f9b17acd198b4f1734c5c"
    );

    expect(trapdoor, "trapdoor").to.equal(expTrapdoor);
    expect(nullifier, "nullifier").to.equal(expNullifier);
    expect(secretHash, "secret hash").to.equal(expSecretHash);
    expect(commitment, "commitment").to.equal(expCommitment);
  });
});
