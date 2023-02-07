import { expect } from "chai";
import fc from "fast-check";

import { getPublicKey } from "./crypto/index.js";
import { createDecoder, createEncoder } from "./symmetric.js";

const TestContentTopic = "/test/1/waku-message/utf8";

describe("Symmetric Encryption", function () {
  it("Round trip binary encryption [symmetric, no signature]", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (payload, symKey) => {
          const encoder = createEncoder({
            contentTopic: TestContentTopic,
            symKey,
          });
          const bytes = await encoder.toWire({ payload });

          const decoder = createDecoder(TestContentTopic, symKey);
          const protoResult = await decoder.fromWireToProtoObj(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.fromProtoObj(protoResult);
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

          const encoder = createEncoder({
            contentTopic: TestContentTopic,
            symKey,
            sigPrivKey,
          });
          const bytes = await encoder.toWire({ payload });

          const decoder = createDecoder(TestContentTopic, symKey);
          const protoResult = await decoder.fromWireToProtoObj(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.fromProtoObj(protoResult);
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
