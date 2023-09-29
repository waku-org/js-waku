import { createDecoder } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { expect } from "chai";

import { makeLogFileName, NimGoNode, tearDownNodes } from "../../src/index.js";

import {
  processMessages,
  sendMessages,
  startAndConnectLightNode
} from "./utils.js";

const customPubSubTopic = "/waku/2/custom-dapp/proto";
const TestContentTopic = "/test/1/waku-store/utf8";
const CustomPubSubTestDecoder = createDecoder(
  TestContentTopic,
  customPubSubTopic
);
const totalMsgs = 20;

describe("Waku Store, custom pubsub topic", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.startWithRetries({
      store: true,
      relay: true,
      topic: customPubSubTopic
    });
    await nwaku.ensureSubscriptions([customPubSubTopic]);
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku], [waku]);
  });

  it("Generator, custom pubsub topic", async function () {
    await sendMessages(nwaku, totalMsgs, TestContentTopic, customPubSubTopic);
    waku = await startAndConnectLightNode(nwaku, [customPubSubTopic]);
    const messages = await processMessages(
      waku,
      [CustomPubSubTestDecoder],
      customPubSubTopic
    );

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result).to.not.eq(-1);
  });
});
