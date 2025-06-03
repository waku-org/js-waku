import { LightPushCodecV2 } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { LightPushCodecV3 } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";
import { LightPushV3TestCollector } from "../../src/light_push_test_utils.js";

import { TestEncoder, TestPubsubTopic, TestShardInfo } from "./utils.js";

const log = new Logger("test:light-push-v3");

describe("Light Push V3 Protocol", function () {
  this.timeout(30000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;
  let responseCollector: LightPushV3TestCollector;

  beforeEachCustom(this, async () => {
    responseCollector = LightPushV3TestCollector.getInstance();
    responseCollector.clear();

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true },
      undefined,
      2,
      true
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("Protocol Selection: should detect and use v3 protocol with v3-capable peers", async function () {
    const peers = await waku.libp2p.peerStore.all();
    const v3Peers = peers.filter((p) => p.protocols.includes(LightPushCodecV3));

    expect(v3Peers.length).to.be.greaterThan(0);
    log.info(`Found ${v3Peers.length} peers supporting Light Push v3`);

    // Test actual protocol selection by sending a message
    const result = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Protocol selection test message")
    });

    expect(result.successes.length).to.be.greaterThan(0);

    // Verify v3 was actually used via response metadata
    if (result.responses) {
      const v3Responses = result.responses.filter(
        (r) => r.protocolUsed === LightPushCodecV3
      );
      expect(v3Responses.length).to.be.greaterThan(0);
      log.info(
        `Used v3 protocol for ${v3Responses.length}/${result.responses.length} peers`
      );

      // Capture responses for later verification
      result.responses.forEach((response) => {
        responseCollector.captureResponse({
          peerId: { toString: () => response.peerId } as any,
          protocolUsed: response.protocolUsed,
          requestId: response.requestId,
          statusCode: response.statusCode,
          statusDesc: response.statusDesc,
          relayPeerCount: response.relayPeerCount
        });
      });
    }
  });

  it("Codec Strings: should have correct protocol identifiers", function () {
    expect(LightPushCodecV2).to.equal("/vac/waku/lightpush/2.0.0-beta1");
    expect(LightPushCodecV3).to.equal("/vac/waku/lightpush/3.0.0");
  });

  it("Message Sending: should successfully send messages using v3 protocol", async function () {
    const message: IMessage = {
      payload: utf8ToBytes("Test message for v3 protocol")
    };

    const result = await waku.lightPush.send(TestEncoder, message);

    expect(result.successes.length).to.be.greaterThan(0);
    expect(result.failures.length).to.equal(0);

    // Verify message was received by nwaku
    const messagesReceived =
      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: TestPubsubTopic
      });
    expect(messagesReceived).to.be.true;

    // Verify v3 protocol was used and capture response details
    if (result.responses) {
      const v3Responses = result.responses.filter(
        (r) => r.protocolUsed === LightPushCodecV3
      );
      expect(v3Responses.length).to.be.greaterThan(0);

      result.responses.forEach((response) => {
        responseCollector.captureResponse({
          peerId: { toString: () => response.peerId } as any,
          protocolUsed: response.protocolUsed,
          requestId: response.requestId,
          statusCode: response.statusCode,
          statusDesc: response.statusDesc,
          relayPeerCount: response.relayPeerCount
        });
      });

      log.info(
        `Successfully sent message using v3 protocol to ${v3Responses.length} peers`
      );
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

describe("Light Push V3 Response Verification", function () {
  this.timeout(30000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;
  let responseCollector: LightPushV3TestCollector;

  beforeEachCustom(this, async () => {
    responseCollector = LightPushV3TestCollector.getInstance();
    responseCollector.clear();

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true },
      undefined,
      2,
      true
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("should receive valid request IDs in v3 responses", async function () {
    const result = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Request ID validation test")
    });

    expect(result.successes.length).to.be.greaterThan(0);

    if (result.responses) {
      const v3Responses = result.responses.filter(
        (r) => r.protocolUsed === LightPushCodecV3
      );
      expect(v3Responses.length).to.be.greaterThan(0);

      for (const response of v3Responses) {
        expect(response.requestId).to.exist;

        // UUID format validation
        if (response.requestId !== "N/A") {
          expect(response.requestId).to.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            `Invalid UUID format: ${response.requestId}`
          );
        }

        log.info(`Valid request ID received: ${response.requestId}`);
      }
    }
  });

  it("should receive success status codes in v3 responses", async function () {
    const result = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Status code validation test")
    });

    expect(result.successes.length).to.be.greaterThan(0);

    if (result.responses) {
      const v3Responses = result.responses.filter(
        (r) => r.protocolUsed === LightPushCodecV3
      );
      expect(v3Responses.length).to.be.greaterThan(0);

      for (const response of v3Responses) {
        expect(response.statusCode).to.equal(200);
        log.info(`Success status code received: ${response.statusCode}`);
      }
    }
  });
});
