import { wakuFilter } from "@waku/core";
import {
  bytesToUtf8,
  createEncoder,
  createLightNode,
  DEFAULT_CLUSTER_ID,
  defaultLibp2p,
  LightNode,
  Protocols,
  streamContentTopic,
  subscribeToContentTopic,
  utf8ToBytes,
  waitForRemotePeer,
  WakuNode
} from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  ensureShardingConfigured,
  pubsubTopicToSingleShardInfo
} from "@waku/utils";
import { expect } from "chai";

import { makeLogFileName, ServiceNode, tearDownNodes } from "../../src";

describe("SDK: Creating by Content Topic", function () {
  const ContentTopic = "/myapp/1/latest/proto";
  const testMessage = "Test123";
  let nwaku: ServiceNode;
  let waku: LightNode;
  let waku2: LightNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new ServiceNode(makeLogFileName(this) + "1");
    await nwaku.start({
      pubsubTopic: [contentTopicToPubsubTopic(ContentTopic)],
      lightpush: true,
      relay: true,
      filter: true,
      discv5Discovery: true,
      peerExchange: true,
      clusterId: DEFAULT_CLUSTER_ID
    });
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes(nwaku, [waku, waku2]);
  });

  it("given a content topic, creates a waku node and filter subscription", async function () {
    const expectedPubsubTopic = contentTopicToPubsubTopic(ContentTopic);

    waku = (
      await subscribeToContentTopic(ContentTopic, () => {}, {
        peer: await nwaku.getMultiaddrWithId()
      })
    ).waku;

    expect((waku as WakuNode).pubsubTopics).to.include(expectedPubsubTopic);
  });

  it("given a waku node and content topic, creates a filter subscription", async function () {
    const expectedPubsubTopic = contentTopicToPubsubTopic(ContentTopic);

    waku = await createLightNode({
      shardInfo: { contentTopics: [ContentTopic] }
    });
    await subscribeToContentTopic(ContentTopic, () => {}, {
      waku,
      peer: await nwaku.getMultiaddrWithId()
    });

    expect((waku as WakuNode).pubsubTopics).to.include(expectedPubsubTopic);
  });

  it("receives messages sent to provided content topic through callback", async function () {
    const messages: string[] = [];
    waku = (
      await subscribeToContentTopic(
        ContentTopic,
        (msg) => {
          messages.push(bytesToUtf8(msg.payload));
        },
        {
          peer: await nwaku.getMultiaddrWithId()
        }
      )
    ).waku;

    waku2 = await createLightNode({
      shardInfo: { contentTopics: [ContentTopic] }
    });
    await waku2.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku2, [Protocols.LightPush]);
    const encoder = createEncoder({
      pubsubTopicShardInfo: pubsubTopicToSingleShardInfo(
        contentTopicToPubsubTopic(ContentTopic)
      ),
      contentTopic: ContentTopic
    });
    await waku2.lightPush?.send(encoder, {
      payload: utf8ToBytes(testMessage)
    });

    expect(messages[0]).to.be.eq(testMessage);
  });

  it("receives messages sent to provided content topic through callback (Waku class)", async function () {
    const messages: string[] = [];
    const shardInfo = ensureShardingConfigured({
      contentTopics: [ContentTopic]
    });
    const wakuContentTopic = new WakuNode(
      {
        pubsubTopics: shardInfo.pubsubTopics
      },
      await defaultLibp2p(shardInfo.shardInfo, undefined, {}, undefined),
      undefined,
      undefined,
      wakuFilter({ pubsubTopics: shardInfo.pubsubTopics })
    );
    await wakuContentTopic.subscribeToContentTopic(
      ContentTopic,
      await nwaku.getMultiaddrWithId(),
      (msg) => {
        messages.push(bytesToUtf8(msg.payload));
      }
    );

    waku2 = await createLightNode({
      shardInfo: { contentTopics: [ContentTopic] }
    });
    await waku2.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku2, [Protocols.LightPush]);
    const encoder = createEncoder({
      pubsubTopicShardInfo: pubsubTopicToSingleShardInfo(
        contentTopicToPubsubTopic(ContentTopic)
      ),
      contentTopic: ContentTopic
    });
    await waku2.lightPush?.send(encoder, {
      payload: utf8ToBytes(testMessage)
    });

    expect(messages[0]).to.be.eq(testMessage);
  });

  it("receives messages sent to provided content topic through stream", async function () {
    let stream;
    [stream, waku] = await streamContentTopic(ContentTopic, {
      peer: await nwaku.getMultiaddrWithId()
    });

    waku2 = await createLightNode({
      shardInfo: { contentTopics: [ContentTopic] }
    });
    await waku2.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku2, [Protocols.LightPush]);

    const encoder = createEncoder({
      pubsubTopicShardInfo: pubsubTopicToSingleShardInfo(
        contentTopicToPubsubTopic(ContentTopic)
      ),
      contentTopic: ContentTopic
    });
    await waku2.lightPush?.send(encoder, {
      payload: utf8ToBytes(testMessage)
    });

    const reader = stream.getReader();
    const { value: message } = await reader.read();
    expect(bytesToUtf8(message!.payload)).to.be.eq(testMessage);
  });
});
