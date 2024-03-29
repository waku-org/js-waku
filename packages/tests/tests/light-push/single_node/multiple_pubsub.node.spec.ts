import type { PeerId } from "@libp2p/interface";
import { createEncoder, waitForRemotePeer } from "@waku/core";
import {
  ContentTopicInfo,
  LightNode,
  Protocols,
  ShardInfo,
  SingleShardInfo
} from "@waku/interfaces";
import {
  contentTopicToPubsubTopic,
  contentTopicToShardIndex,
  pubsubTopicToSingleShardInfo,
  singleShardInfoToPubsubTopic
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  isNwakuAtLeast,
  makeLogFileName,
  MessageCollector,
  resolveAutoshardingCluster,
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

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(
      this.ctx,
      [
        singleShardInfoToPubsubTopic(singleShardInfo1),
        singleShardInfoToPubsubTopic(singleShardInfo2)
      ],
      shardInfo
    );
    messageCollector = new MessageCollector(nwaku);
    nimPeerId = await nwaku.getPeerId();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Push message on custom pubsubTopic", async function () {
    const pushResponse = await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.successes[0].toString()).to.eq(nimPeerId.toString());

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
    expect(pushResponse1.successes[0].toString()).to.eq(nimPeerId.toString());
    expect(pushResponse2.successes[0].toString()).to.eq(nimPeerId.toString());

    const messageCollector2 = new MessageCollector(nwaku);

    expect(
      await messageCollector.waitForMessages(1, {
        pubsubTopic: customPubsubTopic1
      })
    ).to.eq(true);

    expect(
      await messageCollector2.waitForMessages(1, {
        pubsubTopic: singleShardInfoToPubsubTopic(singleShardInfo2)
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
      pubsubTopic: [singleShardInfoToPubsubTopic(singleShardInfo2)],
      clusterId: singleShardInfo2.clusterId
    });
    await nwaku2.ensureSubscriptions([
      singleShardInfoToPubsubTopic(singleShardInfo2)
    ]);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(nwaku2);

    await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes("M1")
    });
    await waku.lightPush.send(customEncoder2, {
      payload: utf8ToBytes("M2")
    });

    await messageCollector.waitForMessages(1, {
      pubsubTopic: customPubsubTopic1
    });

    await messageCollector2.waitForMessages(1, {
      pubsubTopic: singleShardInfoToPubsubTopic(singleShardInfo2)
    });

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: customContentTopic1,
      expectedPubsubTopic: customPubsubTopic1
    });
    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customContentTopic2,
      expectedPubsubTopic: singleShardInfoToPubsubTopic(singleShardInfo2)
    });
  });
});

describe("Waku Light Push (Autosharding): Multiple PubsubTopics", function () {
  this.timeout(30000);
  let waku: LightNode;
  let nwaku: ServiceNode;
  let nwaku2: ServiceNode;
  let messageCollector: MessageCollector;

  const clusterId = resolveAutoshardingCluster(4);
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
    pubsubTopicShardInfo: pubsubTopicToSingleShardInfo(autoshardingPubsubTopic1)
  });
  const customEncoder2 = createEncoder({
    contentTopic: customContentTopic2,
    pubsubTopicShardInfo: pubsubTopicToSingleShardInfo(autoshardingPubsubTopic2)
  });

  let nimPeerId: PeerId;

  before(async () => {
    if (!isNwakuAtLeast("0.27.0")) {
      this.ctx.skip();
    }
  });

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(
      this.ctx,
      [autoshardingPubsubTopic1, autoshardingPubsubTopic2],
      shardInfo
    );
    messageCollector = new MessageCollector(nwaku);
    nimPeerId = await nwaku.getPeerId();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Push message on custom pubsubTopic", async function () {
    const pushResponse = await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.failures).to.be.empty;
    expect(pushResponse.successes[0].toString()).to.eq(nimPeerId.toString());

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
    expect(pushResponse1.successes[0].toString()).to.eq(nimPeerId.toString());
    expect(pushResponse2.successes[0].toString()).to.eq(nimPeerId.toString());

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
      pubsubTopic: [autoshardingPubsubTopic2],
      clusterId: shardInfo.clusterId
    });
    await nwaku2.ensureSubscriptionsAutosharding([customContentTopic2]);
    await waku.dial(await nwaku2.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const messageCollector2 = new MessageCollector(nwaku2);

    await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes("M1")
    });
    await waku.lightPush.send(customEncoder2, {
      payload: utf8ToBytes("M2")
    });

    await messageCollector.waitForMessagesAutosharding(1, {
      contentTopic: customContentTopic1
    });
    await messageCollector2.waitForMessagesAutosharding(1, {
      contentTopic: customContentTopic2
    });

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

  const clusterId = 0;
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
  const customEncoder1 = createEncoder({
    contentTopic: customContentTopic1,
    pubsubTopicShardInfo: {
      clusterId,
      shard: contentTopicToShardIndex(customContentTopic1)
    }
  });
  const customEncoder2 = createEncoder({
    contentTopic: customContentTopic2,
    pubsubTopicShardInfo: {
      clusterId,
      shard: contentTopicToShardIndex(customContentTopic2)
    }
  });

  let nimPeerId: PeerId;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runNodes(this.ctx, [
      autoshardingPubsubTopic1,
      autoshardingPubsubTopic2
    ]);
    messageCollector = new MessageCollector(nwaku);
    nimPeerId = await nwaku.getPeerId();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku, nwaku2], waku);
  });

  it("Push message on custom pubsubTopic", async function () {
    const pushResponse = await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes(messageText)
    });

    expect(pushResponse.successes[0].toString()).to.eq(nimPeerId.toString());

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
    expect(pushResponse1.successes[0].toString()).to.eq(nimPeerId.toString());
    expect(pushResponse2.successes[0].toString()).to.eq(nimPeerId.toString());

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

    await waku.lightPush.send(customEncoder1, {
      payload: utf8ToBytes("M1")
    });
    await waku.lightPush.send(customEncoder2, {
      payload: utf8ToBytes("M2")
    });

    await messageCollector.waitForMessages(1, {
      pubsubTopic: autoshardingPubsubTopic1
    });
    await messageCollector2.waitForMessages(1, {
      pubsubTopic: autoshardingPubsubTopic2
    });

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
