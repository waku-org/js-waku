import type { IProtoMessage } from "@waku/interfaces";
import { expect } from "chai";
import fc from "fast-check";

import { createDecoder, createEncoder, DecodedMessage } from "./version_0.js";

describe("Waku Message version 0", function () {
  it("Round trip binary serialization", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.uint8Array({ minLength: 1 }),
        async (contentTopic, pubSubTopic, payload) => {
          const encoder = createEncoder({
            contentTopic,
          });
          const bytes = await encoder.toWire({ payload });
          const decoder = createDecoder(contentTopic);
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubSubTopic,
            protoResult!
          )) as DecodedMessage;

          expect(result.contentTopic).to.eq(contentTopic);
          expect(result.pubSubTopic).to.eq(pubSubTopic);
          expect(result.version).to.eq(0);
          expect(result.ephemeral).to.be.false;
          expect(result.payload).to.deep.eq(payload);
          expect(result.timestamp).to.not.be.undefined;
        }
      )
    );
  });

  it("Ephemeral field set to true", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.uint8Array({ minLength: 1 }),
        async (contentTopic, pubSubTopic, payload) => {
          const encoder = createEncoder({
            contentTopic,
            ephemeral: true,
          });
          const bytes = await encoder.toWire({ payload });
          const decoder = createDecoder(contentTopic);
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubSubTopic,
            protoResult!
          )) as DecodedMessage;

          expect(result.ephemeral).to.be.true;
        }
      )
    );
  });

  it("Meta field set when metaSetter is specified", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.uint8Array({ minLength: 1 }),
        async (contentTopic, pubSubTopic, payload) => {
          // Encode the length of the payload
          // Not a relevant real life example
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
            ephemeral: true,
            metaSetter,
          });
          const bytes = await encoder.toWire({ payload });
          const decoder = createDecoder(contentTopic);
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubSubTopic,
            protoResult!
          )) as DecodedMessage;

          const expectedMeta = metaSetter({
            payload,
            timestamp: undefined,
            contentTopic: "",
            ephemeral: undefined,
            meta: undefined,
            rateLimitProof: undefined,
            version: undefined,
          });

          expect(result.meta).to.deep.eq(expectedMeta);
        }
      )
    );
  });

  it("isMetaValid returns true when no validator specified", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.uint8Array({ minLength: 1 }),
        async (pubSubTopic, contentTopic, payload) => {
          const encoder = createEncoder({
            contentTopic,
          });
          const bytes = await encoder.toWire({ payload });
          const decoder = createDecoder(contentTopic);
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubSubTopic,
            protoResult!
          )) as DecodedMessage;

          expect(result.isMetaValid()).to.be.true;
        }
      )
    );
  });

  it("isMetaValid returns false when validator specified returns false", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.uint8Array({ minLength: 1 }),
        async (pubSubTopic, contentTopic, payload) => {
          const encoder = createEncoder({
            contentTopic,
          });
          const decoder = createDecoder(contentTopic, () => false);

          const bytes = await encoder.toWire({ payload });
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubSubTopic,
            protoResult!
          )) as DecodedMessage;

          expect(result.isMetaValid()).to.be.false;
        }
      )
    );
  });

  it("isMetaValid returns true when matching meta setter", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.uint8Array({ minLength: 1 }),
        async (pubSubTopic, contentTopic, payload) => {
          const metaSetter = (
            msg: IProtoMessage & { meta: undefined }
          ): Uint8Array => {
            const buffer = new ArrayBuffer(4);
            const view = new DataView(buffer);
            view.setUint32(0, msg.payload.length);
            return new Uint8Array(buffer);
          };

          const encoder = createEncoder({
            contentTopic,
            metaSetter,
          });

          const metaValidator = (
            _pubSubTopic: string,
            message: IProtoMessage
          ): boolean => {
            if (!message.meta) return false;

            const view = new DataView(
              message.meta.buffer,
              message.meta.byteOffset,
              4
            );
            const metaInt = view.getUint32(0);

            return metaInt === message.payload.length;
          };
          const decoder = createDecoder(contentTopic, metaValidator);

          const bytes = await encoder.toWire({ payload });
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubSubTopic,
            protoResult!
          )) as DecodedMessage;

          expect(result.isMetaValid()).to.be.true;
        }
      )
    );
  });
});
