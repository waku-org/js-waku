import type { PeerId } from "@libp2p/interface/peer-id";
import {
  createEncoder,
  DefaultPubsubTopic,
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

describe("Waku Light Push : Multiple PubsubTopics", function () {
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let messageCollector: MessageCollector;
  const customPubsubTopic = "/waku/2/custom-dapp/proto";
  const customContentTopic = "/test/2/waku-light-push/utf8";
  const customEncoder = createEncoder({
    contentTopic: customContentTopic,
    pubsubTopic: customPubsubTopic
  });
  let nimPeerId: PeerId;

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(this, [
      customPubsubTopic,
      DefaultPubsubTopic
    ]);
    messageCollector = new MessageCollector(nwaku);
    nimPeerId = await nwaku.getPeerId();
  });

  this.afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Push message on custom pubsubTopic", async function () {
    const pushResponse = await waku.lightPush.send(customEncoder, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    expect(
      await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic
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
        pubsubTopic: customPubsubTopic
      })
    ).to.eq(true);

    expect(
      await messageCollector2.waitForMessages(1, {
        pubsubTopic: DefaultPubsubTopic
      })
    ).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic,
      expectedPubsubTopic: customPubsubTopic
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: DefaultPubsubTopic
    });
  });

  it("Light push messages to 2 nwaku nodes each with different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubsubTopic
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      topic: [DefaultPubsubTopic]
    });
    await nwaku2.ensureSubscriptions([DefaultPubsubTopic]);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(nwaku2);

    let pushResponse1: SendResult;
    let pushResponse2: SendResult;
    // Making sure that we send messages to both nwaku nodes
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic
      })) ||
      !(await messageCollector2.waitForMessages(1, {
        pubsubTopic: DefaultPubsubTopic
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
      expectedPubsubTopic: customPubsubTopic
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: DefaultPubsubTopic
    });
  });
});
