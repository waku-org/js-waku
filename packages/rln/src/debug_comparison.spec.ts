import { expect } from "chai";

import { createRLN } from "./create.js";
import { RLNCredentialsManager } from "./credentials_manager.js";
import type { IdentityCredential } from "./identity.js";

describe.only("Debug Comparison", function () {
  this.timeout(10_000);

  it("should compare our implementation with Zerokit", async function () {
    // Seed bytes 0..=9 as in the Rust test
    const seedBytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const seedStr = String.fromCharCode(...seedBytes);

    // Our pure TypeScript implementation
    const mgr = new RLNCredentialsManager();
    const ourCred: IdentityCredential = await (
      mgr as any
    ).generateSeededIdentityCredential(seedStr);

    // Zerokit implementation
    const rlnInstance = await createRLN();
    const zerokitCred: IdentityCredential =
      rlnInstance.zerokit.generateSeededIdentityCredential(seedStr);

    const toBigIntBE = (bytes: Uint8Array): bigint => {
      let res = 0n;
      for (let i = 0; i < bytes.length; i++) {
        res = (res << 8n) + BigInt(bytes[i]);
      }
      return res;
    };

    // Compare values
    const ourTrapdoor = toBigIntBE(ourCred.IDTrapdoor);
    const zerokitTrapdoor = toBigIntBE(zerokitCred.IDTrapdoor);

    const ourNullifier = toBigIntBE(ourCred.IDNullifier);
    const zerokitNullifier = toBigIntBE(zerokitCred.IDNullifier);

    const ourSecretHash = toBigIntBE(ourCred.IDSecretHash);
    const zerokitSecretHash = toBigIntBE(zerokitCred.IDSecretHash);

    const ourCommitment = toBigIntBE(ourCred.IDCommitment);
    const zerokitCommitment = toBigIntBE(zerokitCred.IDCommitment);

    console.log("=== COMPARISON ===");
    console.log("Our trapdoor:    ", ourTrapdoor.toString());
    console.log("Zerokit trapdoor:", zerokitTrapdoor.toString());
    console.log("Match:", ourTrapdoor === zerokitTrapdoor);
    console.log("");
    console.log("Our nullifier:    ", ourNullifier.toString());
    console.log("Zerokit nullifier:", zerokitNullifier.toString());
    console.log("Match:", ourNullifier === zerokitNullifier);
    console.log("");
    console.log("Our secret hash:    ", ourSecretHash.toString());
    console.log("Zerokit secret hash:", zerokitSecretHash.toString());
    console.log("Match:", ourSecretHash === zerokitSecretHash);
    console.log("");
    console.log("Our commitment:    ", ourCommitment.toString());
    console.log("Zerokit commitment:", zerokitCommitment.toString());
    console.log("Match:", ourCommitment === zerokitCommitment);

    // This will tell us exactly where our implementation differs from Zerokit
    expect(ourTrapdoor).to.equal(zerokitTrapdoor, "Trapdoor should match");
  });
});
