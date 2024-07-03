import {
  DefaultPubsubTopic,
  ISubscriptionSDK,
  LightNode
} from "@waku/interfaces";
import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  utf8ToBytes
} from "@waku/sdk";
import { delay } from "@waku/utils";
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

//TODO: add unit tests,

describe("Waku Filter: Peer Management: E2E", function () {
  this.timeout(30000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;
  let subscription: ISubscriptionSDK;

  const pubsubTopic = DefaultPubsubTopic;
  const contentTopic = "/test";

  const encoder = createEncoder({
    pubsubTopic,
    contentTopic
  });

  const decoder = createDecoder(contentTopic, pubsubTopic);

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      undefined,
      undefined,
      5
    );
    const { error, subscription: sub } =
      await waku.filter.createSubscription(pubsubTopic);
    if (!sub || error) {
      throw new Error("Could not create subscription");
    }
    subscription = sub;
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("Number of peers are maintained correctly", async function () {
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

  it("Ping succeeds for all connected peers", async function () {
    await subscription.subscribe([decoder], () => {});
    const pingResult = await subscription.ping();
    expect(pingResult.successes.length).to.equal(waku.filter.numPeersToUse);
    expect(pingResult.failures.length).to.equal(0);
  });

  it("Ping fails for unsubscribed peers", async function () {
    const pingResult = await subscription.ping();
    expect(pingResult.successes.length).to.equal(0);
    expect(pingResult.failures.length).to.be.greaterThan(0);
  });

  it("Keep-alive pings maintain the connection", async function () {
    await subscription.subscribe([decoder], () => {}, { keepAlive: 100 });

    await delay(1000);

    const pingResult = await subscription.ping();
    expect(pingResult.successes.length).to.equal(waku.filter.numPeersToUse);
    expect(pingResult.failures.length).to.equal(0);
  });

  it.only("Renews peer on consistent ping failures", async function () {
    await subscription.subscribe([decoder], () => {}, { keepAlive: 300 });

    const disconnectedNodePeerId = waku.filter.connectedPeers[0].id;
    await waku.connectionManager.dropConnection(disconnectedNodePeerId);

    await delay(5700);

    const pingResult = await subscription.ping();
    expect(pingResult.successes.length).to.equal(waku.filter.numPeersToUse);
    expect(pingResult.failures.length).to.equal(0);

    expect(waku.filter.connectedPeers.length).to.equal(
      waku.filter.numPeersToUse
    );
    expect(
      waku.filter.connectedPeers.some((peer) =>
        peer.id.equals(disconnectedNodePeerId)
      )
    ).to.eq(false);
  });

  it("Maintains correct number of peers after multiple subscribe/unsubscribe cycles", async function () {
    for (let i = 0; i < 3; i++) {
      await subscription.subscribe([decoder], () => {});
      let pingResult = await subscription.ping();
      expect(pingResult.successes.length).to.equal(waku.filter.numPeersToUse);

      await subscription.unsubscribe([contentTopic]);
      pingResult = await subscription.ping();
      expect(pingResult.failures.length).to.be.greaterThan(0);
    }

    await subscription.subscribe([decoder], () => {});
    const finalPingResult = await subscription.ping();
    expect(finalPingResult.successes.length).to.equal(
      waku.filter.numPeersToUse
    );
  });
});
