import { expect } from "chai";
import debug from "debug";

import {
  makeLogFileName,
  MessageRpcResponse,
  NOISE_KEY_1,
  Nwaku,
} from "../../test_utils";
import { delay } from "../../test_utils/delay";
import { createFullNode } from "../create_waku";
import type { WakuFull } from "../interfaces";
import { bytesToUtf8, utf8ToBytes } from "../utils";
import { waitForRemotePeer } from "../wait_for_remote_peer";
import { Protocols } from "../waku";
import { EncoderV0 } from "../waku_message/version_0";

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
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageText = "Light Push works!";

    const pushResponse = await waku.lightPush.push(TestEncoder, {
      payload: utf8ToBytes(messageText),
    });
    expect(pushResponse?.isSuccess).to.be.true;

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
    expect(pushResponse?.isSuccess).to.be.true;

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
