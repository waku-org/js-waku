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

  describe("should fail for invalid key", function () {
    it("key: number", async function () {
      const subscription = await waku.filter.createSubscription([TestDecoder]);
      expect(() => {
        subscription.addEventListener(1, collector.filterCallback);
      }).to.throw();
    });
    it("key: random string", async function () {
      const subscription = await waku.filter.createSubscription([TestDecoder]);
      expect(() => {
        subscription.addEventListener("fail", collector.filterCallback);
      }).to.throw();
    });
    it("key: invalid content topic", async function () {
      const subscription = await waku.filter.createSubscription([TestDecoder]);
      expect(() => {
        subscription.addEventListener(
          "/waku/2/default-waku/test",
          collector.filterCallback
        );
      }).to.throw();
    });
  });
  describe("should pass for a valid key", function () {
    it("key: valid pubsub topic", async function () {
      const subscription = await waku.filter.createSubscription([TestDecoder]);
      expect(() => {
        subscription.addEventListener(
          TestDecoder.contentTopic,
          collector.filterCallback
        );
      }).to.not.throw();
    });
  });
});
