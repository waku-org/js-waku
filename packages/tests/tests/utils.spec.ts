/*
TODO(weboko): skipped until https://github.com/waku-org/js-waku/issues/2431 is resolved

import { createDecoder, createEncoder } from "@waku/core";
import { type LightNode } from "@waku/interfaces";
import { toAsyncIterator } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  ServiceNode,
  tearDownNodes
} from "../src/index.js";

import { runNodes } from "./light-push/utils.js";

chai.use(chaiAsPromised);

const TestContentTopic = "/test/1/waku-filter/default";
const TestShardInfo = {
  contentTopics: [TestContentTopic],
  clusterId: 3
};

const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  pubsubTopicShardInfo: TestShardInfo
});
const TestDecoder = createDecoder(TestContentTopic, TestShardInfo);

describe("Util: toAsyncIterator: Filter", function () {
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, TestShardInfo);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  it("creates an iterator", async function () {
    this.timeout(10000);
    const messageText = "hey, what's up?";
    const sent = { payload: utf8ToBytes(messageText) };

    const { iterator } = await toAsyncIterator(waku.filter, TestDecoder, {
      timeoutMs: 1000
    });

    await waku.lightPush.send(TestEncoder, sent);
    const { value } = await iterator.next();

    expect(value.contentTopic).to.eq(TestContentTopic);
    expect(value.pubsubTopic).to.eq(TestDecoder.pubsubTopic);
    expect(bytesToUtf8(value.payload)).to.eq(messageText);
  });

  it("handles multiple messages", async function () {
    this.timeout(10000);
    const { iterator } = await toAsyncIterator(waku.filter, TestDecoder, {
      timeoutMs: 1000
    });

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering works!")
    });
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering still works!")
    });

    let result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering works!");

    result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering still works!");
  });

  it("unsubscribes", async function () {
    this.timeout(10000);
    const { iterator, stop } = await toAsyncIterator(waku.filter, TestDecoder, {
      timeoutMs: 1000
    });

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received")
    });

    await delay(400);

    await stop();

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should not be received")
    });

    let result = await iterator.next();
    expect(result.done).to.eq(true);
    expect(bytesToUtf8(result.value.payload)).to.eq("This should be received");

    result = await iterator.next();
    expect(result.value).to.eq(undefined);
    expect(result.done).to.eq(true);
  });
});
*/
