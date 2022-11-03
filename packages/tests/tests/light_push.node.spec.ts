import { bytesToUtf8, utf8ToBytes } from "@waku/byte-utils";
import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { EncoderV0 } from "@waku/core/lib/waku_message/version_0";
import { createFullNode } from "@waku/create";
import type { WakuFull } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { expect } from "chai";
import debug from "debug";

import {
  makeLogFileName,
  MessageRpcResponse,
  NOISE_KEY_1,
  Nwaku,
} from "../src";
import { delay } from "../src/delay";

const log = debug("waku:test:lightpush");

const TestContentTopic = "/test/1/waku-light-push/utf8";
const TestEncoder = new EncoderV0(TestContentTopic);

describe("Waku Light Push [node only]", () => {
  let waku: WakuFull;
  let nwaku: Nwaku;

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Push successfully", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ lightpush: true });

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TODO: uniformize usage of multiaddr lib across repos
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageText = "Light Push works!";

    const pushResponse = await waku.lightPush.push(TestEncoder, {
      payload: utf8ToBytes(messageText),
    });
    expect(pushResponse.recipients.length).to.eq(1);

    let msgs: MessageRpcResponse[] = [];

    while (msgs.length === 0) {
      await delay(200);
      msgs = await nwaku.messages();
    }

    expect(msgs[0].contentTopic).to.equal(TestContentTopic);
    expect(bytesToUtf8(new Uint8Array(msgs[0].payload))).to.equal(messageText);
  });

  it("Push on custom pubsub topic", async function () {
    this.timeout(15_000);

    const customPubSubTopic = "/waku/2/custom-dapp/proto";

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ lightpush: true, topics: customPubSubTopic });

    waku = await createFullNode({
      pubSubTopic: customPubSubTopic,
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore TODO: uniformize usage of multiaddr lib across repos
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const nimPeerId = await nwaku.getPeerId();

    const messageText = "Light Push works!";

    log("Send message via lightpush");
    const pushResponse = await waku.lightPush.push(
      TestEncoder,
      { payload: utf8ToBytes(messageText) },
      {
        peerId: nimPeerId,
        pubSubTopic: customPubSubTopic,
      }
    );
    log("Ack received", pushResponse);
    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    let msgs: MessageRpcResponse[] = [];

    log("Waiting for message to show in nwaku");
    while (msgs.length === 0) {
      await delay(200);
      msgs = await nwaku.messages(customPubSubTopic);
    }

    expect(msgs[0].contentTopic).to.equal(TestContentTopic);
    expect(bytesToUtf8(new Uint8Array(msgs[0].payload))!).to.equal(messageText);
  });
});
