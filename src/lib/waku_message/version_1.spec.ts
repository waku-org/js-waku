import { expect } from "chai";
import fc from "fast-check";

import { getPublicKey } from "../crypto";

import {
  AsymDecoder,
  AsymEncoder,
  decryptAsymmetric,
  decryptSymmetric,
  encryptAsymmetric,
  encryptSymmetric,
  postCipher,
  preCipher,
  SymDecoder,
  SymEncoder,
} from "./version_1";

const TestContentTopic = "/test/1/waku-message/utf8";

describe("Waku Message version 1", function () {
  it("Round trip binary encryption [asymmetric, no signature]", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (payload, privateKey) => {
          const publicKey = getPublicKey(privateKey);

          const encoder = new AsymEncoder(TestContentTopic, publicKey);
          const bytes = await encoder.encode({ payload });

          const decoder = new AsymDecoder(TestContentTopic, privateKey);
          const protoResult = await decoder.decodeProto(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.decode(protoResult);
          if (!result) throw "Failed to decode";

          expect(result.contentTopic).to.equal(TestContentTopic);
          expect(result.version).to.equal(1);
          expect(result?.payload).to.deep.equal(payload);
          expect(result.signature).to.be.undefined;
          expect(result.signaturePublicKey).to.be.undefined;
        }
      )
    );
  });

  it("R trip binary encryption [asymmetric, signature]", async function () {
    this.timeout(4000);

    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (payload, alicePrivateKey, bobPrivateKey) => {
          const alicePublicKey = getPublicKey(alicePrivateKey);
          const bobPublicKey = getPublicKey(bobPrivateKey);

          const encoder = new AsymEncoder(
            TestContentTopic,
            bobPublicKey,
            alicePrivateKey
          );
          const bytes = await encoder.encode({ payload });

          const decoder = new AsymDecoder(TestContentTopic, bobPrivateKey);
          const protoResult = await decoder.decodeProto(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.decode(protoResult);
          if (!result) throw "Failed to decode";

          expect(result.contentTopic).to.equal(TestContentTopic);
          expect(result.version).to.equal(1);
          expect(result?.payload).to.deep.equal(payload);
          expect(result.signature).to.not.be.undefined;
          expect(result.signaturePublicKey).to.deep.eq(alicePublicKey);
        }
      )
    );
  });

  it("Round trip binary encryption [symmetric, no signature]", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (payload, symKey) => {
          const encoder = new SymEncoder(TestContentTopic, symKey);
          const bytes = await encoder.encode({ payload });

          const decoder = new SymDecoder(TestContentTopic, symKey);
          const protoResult = await decoder.decodeProto(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.decode(protoResult);
          if (!result) throw "Failed to decode";

          expect(result.contentTopic).to.equal(TestContentTopic);
          expect(result.version).to.equal(1);
          expect(result?.payload).to.deep.equal(payload);
          expect(result.signature).to.be.undefined;
          expect(result.signaturePublicKey).to.be.undefined;
        }
      )
    );
  });

  it("Round trip binary encryption [symmetric, signature]", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (payload, sigPrivKey, symKey) => {
          const sigPubKey = getPublicKey(sigPrivKey);

          const encoder = new SymEncoder(TestContentTopic, symKey, sigPrivKey);
          const bytes = await encoder.encode({ payload });

          const decoder = new SymDecoder(TestContentTopic, symKey);
          const protoResult = await decoder.decodeProto(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.decode(protoResult);
          if (!result) throw "Failed to decode";

          expect(result.contentTopic).to.equal(TestContentTopic);
          expect(result.version).to.equal(1);
          expect(result?.payload).to.deep.equal(payload);
          expect(result.signature).to.not.be.undefined;
          expect(result.signaturePublicKey).to.deep.eq(sigPubKey);
        }
      )
    );
  });
});

describe("Encryption helpers", () => {
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
