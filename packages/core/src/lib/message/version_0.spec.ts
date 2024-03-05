import type { IProtoMessage } from "@waku/interfaces";
import { expect } from "chai";
import fc from "fast-check";

import { createDecoder, createEncoder, DecodedMessage } from "./version_0.js";

describe("Waku Message version 0", function () {
  it("Round trip binary serialization", async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.uint8Array({ minLength: 1 }),
        async (contentTopic, pubsubTopic, payload) => {
          const encoder = createEncoder({
            contentTopic
          });
          const bytes = await encoder.toWire({ payload });
          const decoder = createDecoder(contentTopic);
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubsubTopic,
            protoResult!
          )) as DecodedMessage;

          expect(result.contentTopic).to.eq(contentTopic);
          expect(result.pubsubTopic).to.eq(pubsubTopic);
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
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.uint8Array({ minLength: 1 }),
        async (contentTopic, pubsubTopic, payload) => {
          const encoder = createEncoder({
            contentTopic,
            ephemeral: true
          });
          const bytes = await encoder.toWire({ payload });
          const decoder = createDecoder(contentTopic);
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubsubTopic,
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
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.uint8Array({ minLength: 1 }),
        async (contentTopic, pubsubTopic, payload) => {
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
            metaSetter
          });
          const bytes = await encoder.toWire({ payload });
          const decoder = createDecoder(contentTopic);
          const protoResult = await decoder.fromWireToProtoObj(bytes);
          const result = (await decoder.fromProtoObj(
            pubsubTopic,
            protoResult!
          )) as DecodedMessage;

          const expectedMeta = metaSetter({
            payload,
            timestamp: undefined,
            contentTopic: "",
            ephemeral: undefined,
            meta: undefined,
            rateLimitProof: undefined,
            version: undefined
          });

          expect(result.meta).to.deep.eq(expectedMeta);
        }
      )
    );
  });
});

describe("Ensures content topic is defined", () => {
  it("Encoder throws on undefined content topic", () => {
    const wrapper = function (): void {
      createEncoder({ contentTopic: undefined as unknown as string });
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Encoder throws on empty string content topic", () => {
    const wrapper = function (): void {
      createEncoder({ contentTopic: "" });
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Decoder throws on undefined content topic", () => {
    const wrapper = function (): void {
      createDecoder(undefined as unknown as string);
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Decoder throws on empty string content topic", () => {
    const wrapper = function (): void {
      createDecoder("");
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
});

describe("Sets sharding configuration correctly", () => {
  it("uses static shard pubsub topic instead of autosharding when set", async () => {
    // Create an encoder setup to use autosharding
    const ContentTopic = "/waku/2/content/test.js";
    const autoshardingEncoder = createEncoder({
      pubsubTopicShardInfo: { clusterId: 0 },
      contentTopic: ContentTopic
    });

    // When autosharding is enabled, we expect the shard index to be 1
    expect(autoshardingEncoder.pubsubTopic).to.be.eq("/waku/2/rs/0/1");

    // Create an encoder setup to use static sharding with the same content topic
    const singleShardInfo = { clusterId: 0, shard: 0 };
    const staticshardingEncoder = createEncoder({
      contentTopic: ContentTopic,
      pubsubTopicShardInfo: singleShardInfo
    });

    // When static sharding is enabled, we expect the shard index to be 0
    expect(staticshardingEncoder.pubsubTopic).to.be.eq("/waku/2/rs/0/0");
  });
});
