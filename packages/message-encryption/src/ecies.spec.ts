import { IProtoMessage } from "@waku/interfaces";
import { expect } from "chai";
import fc from "fast-check";

import { getPublicKey } from "./crypto/index.js";
import { createDecoder, createEncoder } from "./ecies.js";

describe("Ecies Encryption", function () {
  this.timeout(20000);
  it("Round trip binary encryption [ecies, no signature]", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (pubsubTopic, contentTopic, payload, privateKey) => {
          const publicKey = getPublicKey(privateKey);

          const encoder = createEncoder({
            contentTopic,
            publicKey
          });
          const bytes = await encoder.toWire({ payload });

          const decoder = createDecoder(contentTopic, privateKey);
          const protoResult = await decoder.fromWireToProtoObj(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.fromProtoObj(pubsubTopic, protoResult);
          if (!result) throw "Failed to decode";

          expect(result.contentTopic).to.equal(contentTopic);
          expect(result.pubsubTopic).to.equal(pubsubTopic);
          expect(result.version).to.equal(1);
          expect(result?.payload).to.deep.equal(payload);
          expect(result.signature).to.be.undefined;
          expect(result.verifySignature(new Uint8Array())).to.be.false;
          expect(result.signaturePublicKey).to.be.undefined;
        }
      )
    );
  });

  it("Round trip binary encryption [ecies, signature]", async function () {
    this.timeout(6000);

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (
          pubsubTopic,
          contentTopic,
          payload,
          alicePrivateKey,
          bobPrivateKey
        ) => {
          const alicePublicKey = getPublicKey(alicePrivateKey);
          const bobPublicKey = getPublicKey(bobPrivateKey);

          const encoder = createEncoder({
            contentTopic,
            publicKey: bobPublicKey,
            sigPrivKey: alicePrivateKey
          });
          const bytes = await encoder.toWire({ payload });

          const decoder = createDecoder(contentTopic, bobPrivateKey);
          const protoResult = await decoder.fromWireToProtoObj(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.fromProtoObj(pubsubTopic, protoResult);
          if (!result) throw "Failed to decode";

          expect(result.contentTopic).to.equal(contentTopic);
          expect(result.pubsubTopic).to.equal(pubsubTopic);
          expect(result.version).to.equal(1);
          expect(result?.payload).to.deep.equal(payload);
          expect(result.signature).to.not.be.undefined;
          expect(result.verifySignature(alicePublicKey)).to.be.true;
          expect(result.signaturePublicKey).to.deep.eq(alicePublicKey);
        }
      )
    );
  });

  it("Check meta is set [ecies]", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ min: 1, minLength: 32, maxLength: 32 }),
        async (pubsubTopic, contentTopic, payload, privateKey) => {
          const publicKey = getPublicKey(privateKey);
          const metaSetter = (
            msg: IProtoMessage & { meta: undefined }
          ): Uint8Array => {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint32(0, msg.payload.length, false);
            return new Uint8Array(buffer);
          };

          const encoder = createEncoder({
            contentTopic,
            publicKey,
            metaSetter
          });
          const bytes = await encoder.toWire({ payload });

          const decoder = createDecoder(contentTopic, privateKey);
          const protoResult = await decoder.fromWireToProtoObj(bytes!);
          if (!protoResult) throw "Failed to proto decode";
          const result = await decoder.fromProtoObj(pubsubTopic, protoResult);
          if (!result) throw "Failed to decode";

          const expectedMeta = metaSetter({
            payload: protoResult.payload,
            timestamp: undefined,
            contentTopic: "",
            ephemeral: undefined,
            meta: undefined,
            rateLimitProof: undefined,
            version: undefined
          });

          expect(result.meta).to.deep.equal(expectedMeta);
        }
      )
    );
  });
});

describe("Ensures content topic is defined", () => {
  it("Encoder throws on undefined content topic", () => {
    const wrapper = function (): void {
      createEncoder({
        contentTopic: undefined as unknown as string,
        publicKey: new Uint8Array()
      });
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Encoder throws on empty string content topic", () => {
    const wrapper = function (): void {
      createEncoder({ contentTopic: "", publicKey: new Uint8Array() });
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Decoder throws on undefined content topic", () => {
    const wrapper = function (): void {
      createDecoder(undefined as unknown as string, new Uint8Array());
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Decoder throws on empty string content topic", () => {
    const wrapper = function (): void {
      createDecoder("", new Uint8Array());
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
});
