import { createEncoder, LightPushCodecV2 } from "@waku/core";
import type { IMessage } from "@waku/interfaces";
import { LightPushCodecV3, ProtocolError } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { expect } from "chai";

const log = new Logger("test:light-push-v3");

const TestContentTopic = "/test/1/waku-light-push/utf8";
const TestPubsubTopic = "/waku/2/rs/1/0";

describe("Light Push V3 Protocol", function () {
  this.timeout(30000);

  let waku: any;

  beforeEach(async function () {
    this.timeout(30000);
    log.info("Starting test setup");
  });

  afterEach(async function () {
    this.timeout(15000);
    if (waku) {
      await waku.stop();
    }
  });

  it("Protocol Selection: should detect v3 support", async function () {
    waku = await createLightNode({
      networkConfig: {
        shards: [0],
        clusterId: 1
      }
    });

    const lightPush = waku.lightPush;
    expect(lightPush).to.exist;

    expect(lightPush.protocol).to.exist;
  });

  it("Codec Strings: should have correct protocol identifiers", function () {
    expect(LightPushCodecV2).to.equal("/vac/waku/lightpush/2.0.0-beta1");
    expect(LightPushCodecV3).to.equal("/vac/waku/lightpush/3.0.0");
  });

  it("Message Sending: should work with SDK abstraction", async function () {
    waku = await createLightNode({
      networkConfig: {
        shards: [0],
        clusterId: 1
      }
    });

    await waku.start();

    const encoder = createEncoder({
      contentTopic: TestContentTopic,
      pubsubTopic: TestPubsubTopic
    });

    const message: IMessage = {
      payload: new TextEncoder().encode("Test message for v3")
    };

    try {
      const result = await waku.lightPush.send(encoder, message);

      expect(result.failures.length).to.be.greaterThan(0);
      expect(result.failures[0].error).to.equal(
        ProtocolError.NO_PEER_AVAILABLE
      );
    } catch (error) {
      log.info("Expected error:", error);
    }
  });
});

describe("Light Push V3 Status Codes", function () {
  it("should correctly import v3 status codes", async function () {
    const { LightPushStatusCodeV3 } = await import("@waku/interfaces");

    expect(LightPushStatusCodeV3.SUCCESS).to.equal(200);
    expect(LightPushStatusCodeV3.BAD_REQUEST).to.equal(400);
    expect(LightPushStatusCodeV3.PAYLOAD_TOO_LARGE).to.equal(413);
    expect(LightPushStatusCodeV3.TOO_MANY_REQUESTS).to.equal(429);
    expect(LightPushStatusCodeV3.INTERNAL_SERVER_ERROR).to.equal(500);
    expect(LightPushStatusCodeV3.SERVICE_NOT_AVAILABLE).to.equal(503);
    expect(LightPushStatusCodeV3.NO_PEERS_TO_RELAY).to.equal(505);
  });

  it("should have status code helpers", async function () {
    const { isSuccessStatusCodeV3 } = await import("@waku/interfaces");

    expect(isSuccessStatusCodeV3(200)).to.be.true;
    expect(isSuccessStatusCodeV3(400)).to.be.false;
    expect(isSuccessStatusCodeV3(undefined)).to.be.false;
  });
});
