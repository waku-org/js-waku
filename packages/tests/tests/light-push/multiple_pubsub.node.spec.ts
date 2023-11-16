import type { PeerId } from "@libp2p/interface/peer-id";
import { createEncoder, waitForRemotePeer } from "@waku/core";
import {
  LightNode,
  Protocols,
  SendResult,
  ShardInfo,
  SingleTopicShardInfo
} from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  createTestShardedTopic,
  makeLogFileName,
  MessageCollector,
  NimGoNode,
  tearDownNodes
} from "../../src/index.js";

import { messageText, runNodes } from "./utils.js";

describe("Waku Light Push : Multiple PubsubTopics", function () {
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: NimGoNode;
  let nwaku2: NimGoNode;
  let messageCollector: MessageCollector;

  const customPubsubTopic1 = createTestShardedTopic(3, 1);
  const customPubsubTopic2 = createTestShardedTopic(3, 2);
  const shardInfo: ShardInfo = { cluster: 3, indexList: [1, 2] };
  const singleTopicShardInfo1: SingleTopicShardInfo = { cluster: 3, index: 1 };
  const singleTopicShardInfo2: SingleTopicShardInfo = { cluster: 3, index: 2 };
  const customContentTopic1 = "/test/2/waku-light-push/utf8";
  const customContentTopic2 = "/test/3/waku-light-push/utf8";
  const customEncoder1 = createEncoder({
    pubsubTopic: singleTopicShardInfo1,
    contentTopic: customContentTopic1
  });
  const customEncoder2 = createEncoder({
    pubsubTopic: singleTopicShardInfo2,
    contentTopic: customContentTopic2
  });

  let nimPeerId: PeerId;

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(
      this,
      [customPubsubTopic1, customPubsubTopic2],
      shardInfo
    );
    messageCollector = new MessageCollector(nwaku);
    nimPeerId = await nwaku.getPeerId();
  });

  this.afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Push message on custom pubsubTopic", async function () {
    const pushResponse = await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    expect(
      await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic1
      })
    ).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: customContentTopic1
    });
  });

  it("Subscribe and receive messages on 2 different pubsubtopics", async function () {
    const pushResponse1 = await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes("M1")
    });
    const pushResponse2 = await waku.lightPush.send(customEncoder2, {
      payload: utf8ToBytes("M2")
    });
    expect(pushResponse1.recipients[0].toString()).to.eq(nimPeerId.toString());
    expect(pushResponse2.recipients[0].toString()).to.eq(nimPeerId.toString());

    const messageCollector2 = new MessageCollector(nwaku);

    expect(
      await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic1
      })
    ).to.eq(true);

    expect(
      await messageCollector2.waitForMessages(1, {
        pubsubTopic: customPubsubTopic2
      })
    ).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: customPubsubTopic2
    });
  });

  it("Light push messages to 2 nwaku nodes each with different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubsubTopic
    nwaku2 = new NimGoNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: [customPubsubTopic2]
    });
    await nwaku2.ensureSubscriptions([customPubsubTopic2]);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(nwaku2);

    let pushResponse1: SendResult;
    let pushResponse2: SendResult;
    // Making sure that we send messages to both nwaku nodes
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic1
      })) ||
      !(await messageCollector2.waitForMessages(1, {
        pubsubTopic: customPubsubTopic2
      })) ||
      pushResponse1!.recipients[0].toString() ===
        pushResponse2!.recipients[0].toString()
    ) {
      pushResponse1 = await waku.lightPush.send(customEncoder1, {
        payload: utf8ToBytes("M1")
      });
      pushResponse2 = await waku.lightPush.send(customEncoder2, {
        payload: utf8ToBytes("M2")
      });
    }

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: customPubsubTopic2
    });
  });
});
