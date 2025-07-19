import type { AutoSharding, IProtoMessage } from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";
import fc from "fast-check";

import { createDecoder, createEncoder, DecodedMessage } from "./version_0.js";

const testContentTopic = "/js-waku/1/tests/bytes";

const testNetworkConfig: AutoSharding = {
  clusterId: 0,
  numShardsInCluster: 8
};
const testRoutingInfo = createRoutingInfo(testNetworkConfig, {
  contentTopic: testContentTopic
});

describe("Waku Message version 0", function () {
  it("Round trip binary serialization", async function () {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1 }), async (payload) => {
        const encoder = createEncoder({
          contentTopic: testContentTopic,
          routingInfo: testRoutingInfo
        });
        const bytes = await encoder.toWire({ payload });
        const decoder = createDecoder(testContentTopic, testRoutingInfo);
        const protoResult = await decoder.fromWireToProtoObj(bytes);
        const result = (await decoder.fromProtoObj(
          testRoutingInfo.pubsubTopic,
          protoResult!
        )) as DecodedMessage;

        expect(result.contentTopic).to.eq(testContentTopic);
        expect(result.pubsubTopic).to.eq(testRoutingInfo.pubsubTopic);
        expect(result.version).to.eq(0);
        expect(result.ephemeral).to.be.false;
        expect(result.payload).to.deep.eq(payload);
        expect(result.timestamp).to.not.be.undefined;
      })
    );
  });

  it("Ephemeral field set to true", async function () {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1 }), async (payload) => {
        const encoder = createEncoder({
          contentTopic: testContentTopic,
          routingInfo: testRoutingInfo,
          ephemeral: true
        });
        const bytes = await encoder.toWire({ payload });
        const decoder = createDecoder(testContentTopic, testRoutingInfo);
        const protoResult = await decoder.fromWireToProtoObj(bytes);
        const result = (await decoder.fromProtoObj(
          testRoutingInfo.pubsubTopic,
          protoResult!
        )) as DecodedMessage;

        expect(result.ephemeral).to.be.true;
      })
    );
  });

  it("Meta field set when metaSetter is specified", async function () {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1 }), async (payload) => {
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
          contentTopic: testContentTopic,
          routingInfo: testRoutingInfo,
          ephemeral: true,
          metaSetter
        });
        const bytes = await encoder.toWire({ payload });
        const decoder = createDecoder(testContentTopic, testRoutingInfo);
        const protoResult = await decoder.fromWireToProtoObj(bytes);
        const result = (await decoder.fromProtoObj(
          testRoutingInfo.pubsubTopic,
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
      })
    );
  });
});

describe("Ensures content topic is defined", () => {
  it("Encoder throws on undefined content topic", () => {
    const wrapper = function (): void {
      createEncoder({
        contentTopic: undefined as unknown as string,
        routingInfo: testRoutingInfo
      });
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Encoder throws on empty string content topic", () => {
    const wrapper = function (): void {
      createEncoder({
        contentTopic: "",
        routingInfo: testRoutingInfo
      });
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Decoder throws on undefined content topic", () => {
    const wrapper = function (): void {
      createDecoder(undefined as unknown as string, testRoutingInfo);
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
  it("Decoder throws on empty string content topic", () => {
    const wrapper = function (): void {
      createDecoder("", testRoutingInfo);
    };

    expect(wrapper).to.throw("Content topic must be specified");
  });
});

describe("Sets sharding configuration correctly", () => {
  it("uses static shard pubsub topic instead of autosharding when set", async () => {
    // Create an encoder setup to use autosharding
    const contentTopic = "/myapp/1/test/proto";
    const autoshardingEncoder = createEncoder({
      contentTopic: contentTopic,
      routingInfo: createRoutingInfo(testNetworkConfig, { contentTopic })
    });

    // When autosharding is enabled, we expect the shard index to be 1
    expect(autoshardingEncoder.pubsubTopic).to.be.eq("/waku/2/rs/0/0");

    // Create an encoder setup to use static sharding with the same content topic
    const staticshardingEncoder = createEncoder({
      contentTopic: contentTopic,
      routingInfo: createRoutingInfo({ clusterId: 0 }, { shardId: 3 })
    });

    // When static sharding is enabled, we expect the shard index to be 0
    expect(staticshardingEncoder.pubsubTopic).to.be.eq("/waku/2/rs/0/3");
  });
});
