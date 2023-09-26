import {
  createEncoder,
  DefaultPubSubTopic,
  waitForRemotePeer
} from "@waku/core";
import { LightNode, Protocols } from "@waku/interfaces";
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
  this.timeout(15000);
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

  beforeEach(async function () {
    [nwaku, waku] = await runNodes(this, [
      customPubSubTopic,
      DefaultPubSubTopic
    ]);
    messageCollector = new MessageCollector(
      customContentTopic,
      customPubSubTopic,
      nwaku
    );
  });

  this.afterEach(async function () {
    tearDownNodes([nwaku, nwaku2], [waku]);
  });

  it("Push message on custom pubSubTopic", async function () {
    const nimPeerId = await nwaku.getPeerId();

    const pushResponse = await waku.lightPush.send(customEncoder, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: customContentTopic
    });
  });

  it("Light push messages to 2 nwaku nodes on 2 different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubSubtopic
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      topic: DefaultPubSubTopic
    });
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(
      TestContentTopic,
      DefaultPubSubTopic,
      nwaku2
    );

    // Making sure that we send messages to both nwaku nodes
    let pushResponse1;
    let pushResponse2;
    while (
      !(await messageCollector.waitForMessages(1)) ||
      !(await messageCollector2.waitForMessages(1)) ||
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
