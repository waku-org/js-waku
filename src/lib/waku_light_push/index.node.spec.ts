import { expect } from "chai";
import debug from "debug";

import { makeLogFileName, NOISE_KEY_1, Nwaku } from "../../test_utils";
import { delay } from "../../test_utils/delay";
import { waitForRemotePeer } from "../wait_for_remote_peer";
import { createWaku, Protocols, Waku } from "../waku";
import { WakuMessage } from "../waku_message";

const dbg = debug("waku:test:lightpush");

const TestContentTopic = "/test/1/waku-light-push/utf8";

describe("Waku Light Push [node only]", () => {
  let waku: Waku;
  let nwaku: Nwaku;

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Push successfully", async function () {
    this.timeout(15_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ lightpush: true });

    waku = await createWaku({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageText = "Light Push works!";
    const message = await WakuMessage.fromUtf8String(
      messageText,
      TestContentTopic
    );

    const pushResponse = await waku.lightPush.push(message);
    expect(pushResponse?.isSuccess).to.be.true;

    let msgs: WakuMessage[] = [];

    while (msgs.length === 0) {
      await delay(200);
      msgs = await nwaku.messages();
    }

    expect(msgs[0].contentTopic).to.equal(message.contentTopic);
    expect(msgs[0].version).to.equal(message.version);
    expect(msgs[0].payloadAsUtf8).to.equal(messageText);
  });

  it("Push on custom pubsub topic", async function () {
    this.timeout(15_000);

    const customPubSubTopic = "/waku/2/custom-dapp/proto";

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ lightpush: true, topics: customPubSubTopic });

    waku = await createWaku({
      pubSubTopic: customPubSubTopic,
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const nimPeerId = await nwaku.getPeerId();

    const messageText = "Light Push works!";
    const message = await WakuMessage.fromUtf8String(
      messageText,
      TestContentTopic
    );

    dbg("Send message via lightpush");
    const pushResponse = await waku.lightPush.push(message, {
      peerId: nimPeerId,
    });
    dbg("Ack received", pushResponse);
    expect(pushResponse?.isSuccess).to.be.true;

    let msgs: WakuMessage[] = [];

    dbg("Waiting for message to show in nwaku");
    while (msgs.length === 0) {
      await delay(200);
      msgs = await nwaku.messages();
    }

    expect(msgs[0].contentTopic).to.equal(message.contentTopic);
    expect(msgs[0].version).to.equal(message.version);
    expect(msgs[0].payloadAsUtf8).to.equal(messageText);
  });
});
