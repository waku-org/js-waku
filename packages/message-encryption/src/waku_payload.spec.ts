import { expect } from "chai";
import fc from "fast-check";

import { getPublicKey } from "./crypto/index";
import {
  decryptAsymmetric,
  decryptSymmetric,
  encryptAsymmetric,
  encryptSymmetric,
  postCipher,
  preCipher
} from "./waku_payload";

describe("Waku Payload", () => {
  it("Asymmetric encrypt & decrypt", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (message, privKey) => {
          const publicKey = getPublicKey(privKey);

          const enc = await encryptAsymmetric(message, publicKey);
          const res = await decryptAsymmetric(enc, privKey);

          expect(res).deep.equal(message);
        }
      )
    );
  });

  it("Symmetric encrypt & Decrypt", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array(),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (message, key) => {
          const enc = await encryptSymmetric(message, key);
          const res = await decryptSymmetric(enc, key);

          expect(res).deep.equal(message);
        }
      )
    );
  });

  it("pre and post cipher", async function () {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array(), async (message) => {
        const enc = await preCipher(message);
        const res = postCipher(enc);

        expect(res?.payload).deep.equal(
          message,
          "Payload was not encrypted then decrypted correctly"
        );
      })
    );
  });

  it("Sign & Recover", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array(),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (message, sigPrivKey) => {
          const sigPubKey = getPublicKey(sigPrivKey);

          const enc = await preCipher(message, sigPrivKey);
          const res = postCipher(enc);

          expect(res?.payload).deep.equal(
            message,
            "Payload was not encrypted then decrypted correctly"
          );
          expect(res?.sig?.publicKey).deep.equal(
            sigPubKey,
            "signature Public key was not recovered from encrypted then decrypted signature"
          );
        }
      )
    );
  });
});
