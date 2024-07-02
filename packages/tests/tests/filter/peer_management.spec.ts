import { DefaultPubsubTopic, LightNode } from "@waku/interfaces";
import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  utf8ToBytes
} from "@waku/sdk";
import { expect } from "chai";
import { describe } from "mocha";

import {
  afterEachCustom,
  beforeEachCustom,
  ServiceNodesFleet
} from "../../src/index.js";
import {
  runMultipleNodes,
  teardownNodesWithRedundancy
} from "../filter/utils.js";

describe("Waku Filter: Peer Management: E2E", function () {
  this.timeout(15000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      undefined,
      undefined,
      5
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  const pubsubTopic = DefaultPubsubTopic;
  const contentTopic = "/test";

  const encoder = createEncoder({
    pubsubTopic,
    contentTopic
  });

  const decoder = createDecoder(contentTopic, pubsubTopic);

  it("Number of peers are maintained correctly", async function () {
    const { error, subscription } =
      await waku.filter.createSubscription(pubsubTopic);
    if (!subscription || error) {
      expect.fail("Could not create subscription");
    }

    const messages: DecodedMessage[] = [];
    const { failures, successes } = await subscription.subscribe(
      [decoder],
      (msg) => {
        messages.push(msg);
      }
    );

    await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    expect(successes.length).to.be.greaterThan(0);
    expect(successes.length).to.be.equal(waku.filter.numPeersToUse);

    if (failures) {
      expect(failures.length).to.equal(0);
    }
  });
});
