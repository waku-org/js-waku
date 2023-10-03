import type { PeerId } from "@libp2p/interface/peer-id";
import {
  createEncoder,
  DefaultPubSubTopic,
  waitForRemotePeer
} from "@waku/core";
import { LightNode, Protocols, SendResult } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  makeLogFileName,
  MessageCollector,
  NimGoNode,
  tearDownNodes
} from "../../src/index.js";

import {
  messageText,
  runNodes,
  TestContentTopic,
  TestEncoder
} from "./utils.js";

describe("Waku Light Push : Multiple PubSubtopics", function () {
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let messageCollector: MessageCollector;
  const customPubSubTopic = "/waku/2/custom-dapp/proto";
  const customContentTopic = "/test/2/waku-light-push/utf8";
  const customEncoder = createEncoder({
    contentTopic: customContentTopic,
    pubSubTopic: customPubSubTopic
  });
  let nimPeerId: PeerId;

  beforeEach(async function () {
    [nwaku, waku] = await runNodes(this, [
      customPubSubTopic,
      DefaultPubSubTopic
    ]);
    messageCollector = new MessageCollector(nwaku);
    nimPeerId = await nwaku.getPeerId();
  });

  this.afterEach(async function () {
    tearDownNodes([nwaku, nwaku2], [waku]);
  });

  it("Push message on custom pubSubTopic", async function () {
    const pushResponse = await waku.lightPush.send(customEncoder, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    expect(
      await messageCollector.waitForMessages(1, {
        pubSubTopic: customPubSubTopic
      })
    ).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: customContentTopic
    });
  });

  it("Subscribe and receive messages on 2 different pubsubtopics", async function () {
    const pushResponse1 = await waku.lightPush.send(customEncoder, {
      payload: utf8ToBytes("M1")
    });
    const pushResponse2 = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("M2")
    });
    expect(pushResponse1.recipients[0].toString()).to.eq(nimPeerId.toString());
    expect(pushResponse2.recipients[0].toString()).to.eq(nimPeerId.toString());

    const messageCollector2 = new MessageCollector(nwaku);

    expect(
      await messageCollector.waitForMessages(1, {
        pubSubTopic: customPubSubTopic
      })
    ).to.eq(true);

    expect(
      await messageCollector2.waitForMessages(1, {
        pubSubTopic: DefaultPubSubTopic
      })
    ).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic,
      expectedPubSubTopic: customPubSubTopic
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic,
      expectedPubSubTopic: DefaultPubSubTopic
    });
  });

  it("Light push messages to 2 nwaku nodes each with different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubSubtopic
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      topic: [DefaultPubSubTopic]
    });
    await nwaku2.ensureSubscriptions([DefaultPubSubTopic]);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(nwaku2);

    let pushResponse1: SendResult;
    let pushResponse2: SendResult;
    // Making sure that we send messages to both nwaku nodes
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessages(1, {
        pubSubTopic: customPubSubTopic
      })) ||
      !(await messageCollector2.waitForMessages(1, {
        pubSubTopic: DefaultPubSubTopic
      })) ||
      pushResponse1!.recipients[0].toString() ===
        pushResponse2!.recipients[0].toString()
    ) {
      pushResponse1 = await waku.lightPush.send(customEncoder, {
        payload: utf8ToBytes("M1")
      });
      pushResponse2 = await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes("M2")
      });
    }

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic,
      expectedPubSubTopic: customPubSubTopic
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic,
      expectedPubSubTopic: DefaultPubSubTopic
    });
  });
});
