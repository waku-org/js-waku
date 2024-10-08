import type { PeerId } from "@libp2p/interface";
import { DecodedMessage } from "@waku/core";
import { Protocols, RelayNode } from "@waku/interfaces";
import { createRelayNode } from "@waku/relay";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  afterEachCustom,
  base64ToUtf8,
  beforeEachCustom,
  delay,
  NOISE_KEY_2,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";
import { MessageRpcResponse } from "../../src/types.js";

import {
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  TestPubsubTopic,
  TestShardInfo
} from "./utils.js";
import { runRelayNodes } from "./utils.js";

describe("Waku Relay, Interop", function () {
  this.timeout(15000);
  let waku: RelayNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runRelayNodes(this.ctx, TestShardInfo);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  it("nwaku subscribes", async function () {
    let subscribers: PeerId[] = [];

    while (subscribers.length === 0) {
      await delay(200);
      subscribers =
        waku.libp2p.services.pubsub!.getSubscribers(TestPubsubTopic);
    }

    const nimPeerId = await nwaku.getPeerId();
    expect(subscribers.map((p) => p.toString())).to.contain(
      nimPeerId.toString()
    );
  });

  it("Publishes to nwaku", async function () {
    const messageText = "This is a message";
    await waku.relay.send(TestEncoder, { payload: utf8ToBytes(messageText) });

    let msgs: MessageRpcResponse[] = [];

    while (msgs.length === 0) {
      await delay(200);
      msgs = await nwaku.messages();
    }

    expect(msgs[0].contentTopic).to.equal(TestContentTopic);
    expect(msgs[0].version).to.equal(0);
    expect(base64ToUtf8(msgs[0].payload)).to.equal(messageText);
  });

  it("Nwaku publishes", async function () {
    await delay(200);

    const messageText = "Here is another message.";

    const receivedMsgPromise: Promise<DecodedMessage> = new Promise(
      (resolve) => {
        void waku.relay.subscribeWithUnsubscribe<DecodedMessage>(
          TestDecoder,
          (msg) => resolve(msg)
        );
      }
    );

    await nwaku.sendMessage(
      ServiceNode.toMessageRpcQuery({
        contentTopic: TestContentTopic,
        payload: utf8ToBytes(messageText)
      })
    );

    const receivedMsg = await receivedMsgPromise;

    expect(receivedMsg.contentTopic).to.eq(TestContentTopic);
    expect(receivedMsg.version!).to.eq(0);
    expect(bytesToUtf8(receivedMsg.payload!)).to.eq(messageText);
  });

  it("Js publishes, other Js receives", async function () {
    const waku2 = await createRelayNode({
      staticNoiseKey: NOISE_KEY_2,
      emitSelf: true,
      networkConfig: TestShardInfo
    });
    await waku2.start();

    const nwakuMultiaddr = await nwaku.getMultiaddrWithId();
    await waku2.dial(nwakuMultiaddr);

    await waku2.waitForPeers([Protocols.Relay]);

    await delay(2000);
    // Check that the two JS peers are NOT directly connected
    expect(await waku.libp2p.peerStore.has(waku2.libp2p.peerId)).to.eq(false);
    expect(await waku2.libp2p.peerStore.has(waku.libp2p.peerId)).to.eq(false);

    const msgStr = "Hello there!";
    const message = { payload: utf8ToBytes(msgStr) };

    const waku2ReceivedMsgPromise: Promise<DecodedMessage> = new Promise(
      (resolve) => {
        void waku2.relay.subscribeWithUnsubscribe(TestDecoder, resolve);
      }
    );

    await waku.relay.send(TestEncoder, message);
    const waku2ReceivedMsg = await waku2ReceivedMsgPromise;

    expect(bytesToUtf8(waku2ReceivedMsg.payload)).to.eq(msgStr);

    await tearDownNodes([], waku);
  });
});
