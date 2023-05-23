import {
  createDecoder,
  createEncoder,
  DefaultPubSubTopic,
  waitForRemotePeer,
} from "@waku/core";
import { createLightNode } from "@waku/create";
import type { IFilter, IFilterV2, LightNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { toAsyncIterator } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { makeLogFileName, NOISE_KEY_1 } from "../src/index.js";
import { NimGoNode } from "../src/node/node.js";

const TestContentTopic = "/test/1/waku-filter";
const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
const TestDecoder = createDecoder(TestContentTopic);

describe("Util: toAsyncIterator: FilterV1", () => {
  let waku: LightNode;
  let nwaku: NimGoNode;

  let filter: IFilter;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.start({
      filter: true,
      lightpush: true,
      relay: true,
      legacyFilter: true,
    });
    waku = await createLightNode({
      useFilterV1: true,
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    filter = waku.filter as IFilter;
  });

  afterEach(async () => {
    try {
      await nwaku.stop();
      await waku.stop();
    } catch (err) {
      console.log("Failed to stop", err);
    }
  });

  it("creates an iterator", async function () {
    this.timeout(10000);
    const messageText = "hey, what's up?";
    const sent = { payload: utf8ToBytes(messageText) };

    const { iterator } = await toAsyncIterator(
      filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, sent);
    const { value } = await iterator.next();

    expect(value.contentTopic).to.eq(TestContentTopic);
    expect(value.pubSubTopic).to.eq(DefaultPubSubTopic);
    expect(bytesToUtf8(value.payload)).to.eq(messageText);
  });

  it("handles multiple messages", async function () {
    this.timeout(10000);
    const { iterator } = await toAsyncIterator(
      filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering works!"),
    });
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering still works!"),
    });

    let result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering works!");

    result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering still works!");
  });

  it("unsubscribes", async function () {
    this.timeout(10000);
    const { iterator, stop } = await toAsyncIterator(
      filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received"),
    });

    await stop();

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should not be received"),
    });

    let result = await iterator.next();
    expect(result.done).to.eq(true);
    expect(bytesToUtf8(result.value.payload)).to.eq("This should be received");

    result = await iterator.next();
    expect(result.value).to.eq(undefined);
    expect(result.done).to.eq(true);
  });
});

describe("Util: toAsyncIterator: FilterV2", () => {
  let waku: LightNode;
  let nwaku: NimGoNode;

  let filter: IFilterV2;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.start({ filter: true, lightpush: true, relay: true });
    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    filter = waku.filter as IFilterV2;
  });

  afterEach(async () => {
    try {
      await nwaku.stop();
      await waku.stop();
    } catch (err) {
      console.log("Failed to stop", err);
    }
  });

  it("creates an iterator", async function () {
    this.timeout(10000);
    const messageText = "hey, what's up?";
    const sent = { payload: utf8ToBytes(messageText) };

    const { iterator } = await toAsyncIterator(
      filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, sent);
    const { value } = await iterator.next();

    expect(value.contentTopic).to.eq(TestContentTopic);
    expect(value.pubSubTopic).to.eq(DefaultPubSubTopic);
    expect(bytesToUtf8(value.payload)).to.eq(messageText);
  });

  it("handles multiple messages", async function () {
    this.timeout(10000);
    const { iterator } = await toAsyncIterator(
      filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering works!"),
    });
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering still works!"),
    });

    let result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering works!");

    result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering still works!");
  });

  it("unsubscribes", async function () {
    this.timeout(10000);
    const { iterator, stop } = await toAsyncIterator(
      filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received"),
    });

    await stop();

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should not be received"),
    });

    let result = await iterator.next();
    expect(result.done).to.eq(true);
    expect(bytesToUtf8(result.value.payload)).to.eq("This should be received");

    result = await iterator.next();
    expect(result.value).to.eq(undefined);
    expect(result.done).to.eq(true);
  });
});
