import { DefaultPubSubTopic } from "@waku/core";
import type { IFilterSubscription, LightNode } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { MessageCollector, NimGoNode, tearDownNodes } from "../../src/index.js";

import {
  runNodes,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  validatePingError
} from "./utils.js";

describe("Waku Filter V2: Ping", function () {
  // Set the timeout for all tests in this suite. Can be overwritten at test level
  this.timeout(10000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let subscription: IFilterSubscription;
  let messageCollector: MessageCollector;

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(this, [DefaultPubSubTopic]);
    subscription = await waku.filter.createSubscription();
    messageCollector = new MessageCollector();
  });

  this.afterEach(async function () {
    tearDownNodes([nwaku], [waku]);
  });

  it("Ping on subscribed peer", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M1") });
    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    // If ping is successfull(node has active subscription) we receive a success status code.
    await subscription.ping();

    await waku.lightPush.send(TestEncoder, { payload: utf8ToBytes("M2") });

    // Confirm new messages are received after a ping.
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
  });

  it("Ping on peer without subscriptions", async function () {
    await validatePingError(subscription);
  });

  it("Ping on unsubscribed peer", async function () {
    await subscription.subscribe([TestDecoder], messageCollector.callback);
    await subscription.ping();
    await subscription.unsubscribe([TestContentTopic]);

    // Ping imediately after unsubscribe
    await validatePingError(subscription);
  });
});