import { LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { NimGoNode } from "../../src/index.js";

import {
  MessageCollector,
  messageText,
  runNodes,
  tearDownNodes,
  TestContentTopic,
  TestEncoder
} from "./light_push_test_utils.js";

describe("Waku Light Push [node only] - custom pubsub topic", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let messageCollector: MessageCollector;
  const customPubSubTopic = "/waku/2/custom-dapp/proto";

  beforeEach(async function () {
    [nwaku, waku] = await runNodes(this, customPubSubTopic);
    messageCollector = new MessageCollector(nwaku, customPubSubTopic);
  });

  this.afterEach(async function () {
    tearDownNodes(nwaku, waku);
  });

  it("Push message", async function () {
    const nimPeerId = await nwaku.getPeerId();

    const pushResponse = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
  });
});
