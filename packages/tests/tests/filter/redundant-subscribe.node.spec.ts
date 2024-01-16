import type { IFilterSubscription, LightNode } from "@waku/interfaces";
import { DefaultPubsubTopic } from "@waku/interfaces";
import { expect } from "chai";

import { ServiceNodes } from "../../src/index.js";

import {
  messagePayload,
  messageText,
  runMultipleNodes,
  teardownNodesWithRedundancy,
  TestContentTopic,
  TestDecoder,
  TestEncoder
} from "./utils.js";

describe("Waku Filter V2: Subscribe: Redundant", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(100000);
  let waku: LightNode;
  let serviceNodes: ServiceNodes;
  let subscription: IFilterSubscription;

  this.beforeEach(async function () {
    this.timeout(15000);
    [serviceNodes, waku] = await runMultipleNodes(
      this,
      [DefaultPubsubTopic],
      undefined,
      3
    );
    subscription = await waku.filter.createSubscription();
  });

  this.afterEach(async function () {
    this.timeout(15000);
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("Subscribe and receive messages via lightPush", async function () {
    expect(waku.libp2p.getConnections()).has.length(3);

    await subscription.subscribe(
      [TestDecoder],
      serviceNodes.messageCollector.callback
    );

    await waku.lightPush.send(TestEncoder, messagePayload);

    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
    serviceNodes.messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });

    // either of the service nodes need to have the message
    await Promise.race(
      serviceNodes.nodes.map(async (node) =>
        expect(await node.messages()).to.have.length(1)
      )
    );
  });
});
