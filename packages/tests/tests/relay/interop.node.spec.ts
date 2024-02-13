import type { PeerId } from "@libp2p/interface";
import { DecodedMessage, waitForRemotePeer } from "@waku/core";
import { DefaultPubsubTopic, Protocols, RelayNode } from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk/relay";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  base64ToUtf8,
  delay,
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  NOISE_KEY_1,
  NOISE_KEY_2,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
} from "../../src/index.js";
import { MessageRpcResponse } from "../../src/types.js";

import { TestContentTopic, TestDecoder, TestEncoder } from "./utils.js";

describe("Waku Relay, Interop", function () {
  this.timeout(15000);
  let waku: RelayNode;
  let nwaku: ServiceNode;

  this.beforeEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const runAllNodes: () => Promise<void> = async () => {
      waku = await createRelayNode({
        staticNoiseKey: NOISE_KEY_1
      });
      await waku.start();

      nwaku = new ServiceNode(this.test?.ctx?.currentTest?.title + "");
      await nwaku.start({ relay: true });

      await waku.dial(await nwaku.getMultiaddrWithId());
      await waitForRemotePeer(waku, [Protocols.Relay]);

      // Nwaku subscribe to the default pubsub topic
      await nwaku.ensureSubscriptions();
    };
    withGracefulTimeout(runAllNodes, done);
  });

  this.afterEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const teardown: () => Promise<void> = async () => {
      await tearDownNodes(nwaku, waku);
    };
    withGracefulTimeout(teardown, done);
  });

  it("nwaku subscribes", async function () {
    let subscribers: PeerId[] = [];

    while (subscribers.length === 0) {
      await delay(200);
      subscribers =
        waku.libp2p.services.pubsub!.getSubscribers(DefaultPubsubTopic);
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
        void waku.relay.subscribe<DecodedMessage>(TestDecoder, (msg) =>
          resolve(msg)
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

  describe("Two nodes connected to nwaku", function () {
    let waku1: RelayNode;
    let waku2: RelayNode;
    let nwaku: ServiceNode;

    this.afterEach(function (done) {
      this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
      const teardown: () => Promise<void> = async () => {
        await tearDownNodes(nwaku, [waku1, waku2]);
      };
      withGracefulTimeout(teardown, done);
    });

    it("Js publishes, other Js receives", async function () {
      [waku1, waku2] = await Promise.all([
        createRelayNode({
          staticNoiseKey: NOISE_KEY_1,
          emitSelf: true
        }).then((waku) => waku.start().then(() => waku)),
        createRelayNode({
          staticNoiseKey: NOISE_KEY_2
        }).then((waku) => waku.start().then(() => waku))
      ]);

      nwaku = new ServiceNode(makeLogFileName(this));
      await nwaku.start({ relay: true });

      const nwakuMultiaddr = await nwaku.getMultiaddrWithId();
      await Promise.all([
        waku1.dial(nwakuMultiaddr),
        waku2.dial(nwakuMultiaddr)
      ]);

      // Wait for identify protocol to finish
      await Promise.all([
        waitForRemotePeer(waku1, [Protocols.Relay]),
        waitForRemotePeer(waku2, [Protocols.Relay])
      ]);

      await delay(2000);
      // Check that the two JS peers are NOT directly connected
      expect(await waku1.libp2p.peerStore.has(waku2.libp2p.peerId)).to.eq(
        false
      );
      expect(await waku2.libp2p.peerStore.has(waku1.libp2p.peerId)).to.eq(
        false
      );

      const msgStr = "Hello there!";
      const message = { payload: utf8ToBytes(msgStr) };

      const waku2ReceivedMsgPromise: Promise<DecodedMessage> = new Promise(
        (resolve) => {
          void waku2.relay.subscribe(TestDecoder, resolve);
        }
      );

      await waku1.relay.send(TestEncoder, message);
      const waku2ReceivedMsg = await waku2ReceivedMsgPromise;

      expect(bytesToUtf8(waku2ReceivedMsg.payload)).to.eq(msgStr);
    });
  });
});
