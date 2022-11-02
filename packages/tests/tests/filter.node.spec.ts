import { bytesToUtf8, utf8ToBytes } from "@waku/core/lib/utils";
import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { DecoderV0, EncoderV0 } from "@waku/core/lib/waku_message/version_0";
import { createFullNode } from "@waku/create";
import type { Message, WakuFull } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { expect } from "chai";
import debug from "debug";

import { makeLogFileName, NOISE_KEY_1, Nwaku } from "../src";
import { delay } from "../src/delay";

const log = debug("waku:test");

const TestContentTopic = "/test/1/waku-filter";
const TestEncoder = new EncoderV0(TestContentTopic);
const TestDecoder = new DecoderV0(TestContentTopic);

describe("Waku Filter", () => {
  let waku: WakuFull;
  let nwaku: Nwaku;

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ filter: true, lightpush: true });
    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    });
    await waku.start();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TODO: uniformize usage of multiaddr lib across repos
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
  });

  it("creates a subscription", async function () {
    this.timeout(10000);

    let messageCount = 0;
    const messageText = "Filtering works!";
    const message = { payload: utf8ToBytes(messageText) };

    const callback = (msg: Message): void => {
      log("Got a message");
      messageCount++;
      expect(msg.contentTopic).to.eq(TestContentTopic);
      expect(bytesToUtf8(msg.payload!)).to.eq(messageText);
    };

    await waku.filter.subscribe([TestDecoder], callback);
    // As the filter protocol does not cater for an ack of subscription
    // we cannot know whether the subscription happened. Something we want to
    // correct in future versions of the protocol.
    await delay(200);

    await waku.lightPush.push(TestEncoder, message);
    while (messageCount === 0) {
      await delay(250);
    }
    expect(messageCount).to.eq(1);
  });

  it("handles multiple messages", async function () {
    this.timeout(10000);

    let messageCount = 0;
    const callback = (msg: Message): void => {
      messageCount++;
      expect(msg.contentTopic).to.eq(TestContentTopic);
    };
    await waku.filter.subscribe([TestDecoder], callback);

    await delay(200);
    await waku.lightPush.push(TestEncoder, {
      payload: utf8ToBytes("Filtering works!"),
    });
    await waku.lightPush.push(TestEncoder, {
      payload: utf8ToBytes("Filtering still works!"),
    });
    while (messageCount < 2) {
      await delay(250);
    }
    expect(messageCount).to.eq(2);
  });

  it("unsubscribes", async function () {
    let messageCount = 0;
    const callback = (): void => {
      messageCount++;
    };
    const unsubscribe = await waku.filter.subscribe([TestDecoder], callback);

    await delay(200);
    await waku.lightPush.push(TestEncoder, {
      payload: utf8ToBytes("This should be received"),
    });
    await delay(100);
    await unsubscribe();
    await delay(200);
    await waku.lightPush.push(TestEncoder, {
      payload: utf8ToBytes("This should not be received"),
    });
    await delay(100);
    expect(messageCount).to.eq(1);
  });
});
