import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import {
  DefaultPubsubTopic,
  type LightNode,
  Protocols
} from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { toAsyncIterator } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";

import {
  delay,
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  NOISE_KEY_1,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
} from "../src/index.js";

chai.use(chaiAsPromised);

const TestContentTopic = "/test/1/waku-filter";
const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
const TestDecoder = createDecoder(TestContentTopic);

describe("Util: toAsyncIterator: Filter", function () {
  let waku: LightNode;
  let nwaku: ServiceNode;

  this.beforeEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const runNodes: () => Promise<void> = async () => {
      nwaku = new ServiceNode(makeLogFileName(this));
      await nwaku.start({
        filter: true,
        lightpush: true,
        relay: true
      });
      waku = await createLightNode({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      });
      await waku.start();
      await waku.dial(await nwaku.getMultiaddrWithId());
      await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    };
    withGracefulTimeout(runNodes, 20000, done);
  });

  this.afterEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const teardown: () => Promise<void> = async () => {
      await tearDownNodes(nwaku, waku);
    };
    withGracefulTimeout(teardown, 20000, done);
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
    expect(value.pubsubTopic).to.eq(DefaultPubsubTopic);
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
