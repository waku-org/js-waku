import type { PeerId } from "@libp2p/interface";
import { createEncoder, waitForRemotePeer } from "@waku/core";
import {
  ContentTopicInfo,
  LightNode,
  Protocols,
  SendResult,
  ShardInfo,
  SingleShardInfo
} from "@waku/interfaces";
import {
  contentTopicToPubsubTopic,
  singleShardInfoToPubsubTopic
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  makeLogFileName,
  MessageCollector,
  ServiceNode,
  tearDownNodes
} from "../../../src/index.js";
import { messageText, runNodes } from "../utils.js";

describe("Waku Light Push : Multiple PubsubTopics", function () {
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let messageCollector: MessageCollector;
  const customPubsubTopic1 = singleShardInfoToPubsubTopic({
    clusterId: 3,
    shard: 1
  });
  const customPubsubTopic2 = singleShardInfoToPubsubTopic({
    clusterId: 3,
    shard: 2
  });
  const shardInfo: ShardInfo = { clusterId: 3, shards: [1, 2] };
  const singleShardInfo1: SingleShardInfo = { clusterId: 3, shard: 1 };
  const singleShardInfo2: SingleShardInfo = { clusterId: 3, shard: 2 };
  const customContentTopic1 = "/test/2/waku-light-push/utf8";
  const customContentTopic2 = "/test/3/waku-light-push/utf8";
  const customEncoder1 = createEncoder({
    pubsubTopicShardInfo: singleShardInfo1,
    contentTopic: customContentTopic1
  });
  const customEncoder2 = createEncoder({
    pubsubTopicShardInfo: singleShardInfo2,
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
      expectedPubsubTopic: customPubsubTopic1
    });
  });

  it("Light push messages to 2 nwaku nodes each with different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubsubTopic
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
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

describe("Waku Light Push (Autosharding): Multiple PubsubTopics", function () {
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let messageCollector: MessageCollector;

  // When using lightpush, we have to use a cluster id of 1 because that is the default cluster id for autosharding
  // With a different cluster id, we never find a viable peer
  const clusterId = 1;
  const customContentTopic1 = "/waku/2/content/test.js";
  const customContentTopic2 = "/myapp/1/latest/proto";
  const autoshardingPubsubTopic1 = contentTopicToPubsubTopic(
    customContentTopic1,
    clusterId
  );
  const autoshardingPubsubTopic2 = contentTopicToPubsubTopic(
    customContentTopic2,
    clusterId
  );
  const shardInfo: ContentTopicInfo = {
    clusterId,
    contentTopics: [customContentTopic1, customContentTopic2]
  };
  const customEncoder1 = createEncoder({
    contentTopic: customContentTopic1,
    pubsubTopicShardInfo: shardInfo
  });
  const customEncoder2 = createEncoder({
    contentTopic: customContentTopic2,
    pubsubTopicShardInfo: shardInfo
  });

  let nimPeerId: PeerId;

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(
      this,
      [autoshardingPubsubTopic1, autoshardingPubsubTopic2],
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

    expect(pushResponse.errors).to.be.empty;
    expect(pushResponse.recipients[0].toString()).to.eq(nimPeerId.toString());

    expect(
      await messageCollector.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic1
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
      await messageCollector.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic1
      })
    ).to.eq(true);

    expect(
      await messageCollector2.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic2
      })
    ).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: autoshardingPubsubTopic1
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: autoshardingPubsubTopic2
    });
  });

  it("Light push messages to 2 nwaku nodes each with different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubsubTopic
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: [autoshardingPubsubTopic2]
    });
    await nwaku2.ensureSubscriptionsAutosharding([customContentTopic2]);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(nwaku2);

    let pushResponse1: SendResult;
    let pushResponse2: SendResult;
    // Making sure that we send messages to both nwaku nodes
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic1
      })) ||
      !(await messageCollector2.waitForMessagesAutosharding(1, {
        contentTopic: customContentTopic2
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
      expectedPubsubTopic: autoshardingPubsubTopic1
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: autoshardingPubsubTopic2
    });
  });
});

describe("Waku Light Push (named sharding): Multiple PubsubTopics", function () {
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let messageCollector: MessageCollector;

  // When using lightpush, we have to use a cluster id of 1 because that is the default cluster id for autosharding
  // With a different cluster id, we never find a viable peer
  const clusterId = 1;
  const customContentTopic1 = "/waku/2/content/utf8";
  const customContentTopic2 = "/myapp/1/latest/proto";
  const autoshardingPubsubTopic1 = contentTopicToPubsubTopic(
    customContentTopic1,
    clusterId
  );
  const autoshardingPubsubTopic2 = contentTopicToPubsubTopic(
    customContentTopic2,
    clusterId
  );
  const contentTopicInfo: ContentTopicInfo = {
    clusterId,
    contentTopics: [customContentTopic1, customContentTopic2]
  };
  const customEncoder1 = createEncoder({
    contentTopic: customContentTopic1,
    pubsubTopicShardInfo: {
      clusterId
    }
  });
  const customEncoder2 = createEncoder({
    contentTopic: customContentTopic2,
    pubsubTopicShardInfo: { clusterId }
  });

  let nimPeerId: PeerId;

  this.beforeEach(async function () {
    this.timeout(15000);
    [nwaku, waku] = await runNodes(
      this,
      [autoshardingPubsubTopic1, autoshardingPubsubTopic2],
      contentTopicInfo
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
        pubsubTopic: autoshardingPubsubTopic1
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
        pubsubTopic: autoshardingPubsubTopic1
      })
    ).to.eq(true);

    expect(
      await messageCollector2.waitForMessages(1, {
        pubsubTopic: autoshardingPubsubTopic2
      })
    ).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: autoshardingPubsubTopic1
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: autoshardingPubsubTopic2
    });
  });

  it("Light push messages to 2 nwaku nodes each with different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubsubTopic
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    await nwaku2.start({
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: [autoshardingPubsubTopic2]
    });
    await nwaku2.ensureSubscriptions([autoshardingPubsubTopic2]);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(nwaku2);

    let pushResponse1: SendResult;
    let pushResponse2: SendResult;
    // Making sure that we send messages to both nwaku nodes
    // While loop is done because of https://github.com/waku-org/js-waku/issues/1606
    while (
      !(await messageCollector.waitForMessages(1, {
        pubsubTopic: autoshardingPubsubTopic1
      })) ||
      !(await messageCollector2.waitForMessages(1, {
        pubsubTopic: autoshardingPubsubTopic2
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
      expectedPubsubTopic: autoshardingPubsubTopic1
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: autoshardingPubsubTopic2
    });
  });
});
