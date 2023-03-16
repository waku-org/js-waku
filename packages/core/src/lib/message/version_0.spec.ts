import { WakuMessage } from "@waku/proto";
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
            msg: WakuMessage & { meta: undefined }
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

          const expectedMeta = metaSetter(
            new WakuMessage({
              payload,
              timestamp: undefined,
              contentTopic: "",
              ephemeral: undefined,
              meta: undefined,
              rateLimitProof: undefined,
              version: undefined,
            }) as WakuMessage & { meta: undefined }
          );

          expect(result.meta).to.deep.eq(expectedMeta);
        }
      )
    );
  });
});
