import { DefaultPubsubTopic } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { expect } from "chai";

import { MessageCollector, NimGoNode, tearDownNodes } from "../../src/index.js";

import { runNodes, TestDecoder } from "./utils.js";

describe("Waku Filter V2: Susbcription: Event Listener", function () {
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let collector: MessageCollector;

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(this, [DefaultPubsubTopic]);
    collector = new MessageCollector();
  });

  this.afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes(nwaku, waku);
  });

  it("should fail for invalid content topic", async function () {
    const subscription = await waku.filter.createSubscription([TestDecoder]);
    expect(() => {
      subscription.addEventListener(
        "/waku/2/default-waku/test",
        collector.filterCallback
      );
    }).to.throw();
  });

  it("should pass for a valid pubsub topic", async function () {
    const subscription = await waku.filter.createSubscription([TestDecoder]);
    expect(() => {
      subscription.addEventListener(
        TestDecoder.contentTopic,
        collector.filterCallback
      );
    }).to.not.throw();
  });
});
