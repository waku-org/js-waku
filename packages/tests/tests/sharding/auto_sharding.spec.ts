import { LightNode, ProtocolError, Protocols } from "@waku/interfaces";
import { createEncoder, createLightNode, utf8ToBytes } from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  contentTopicToShardIndex
} from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  MessageCollector,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

const ContentTopic = "/waku/2/content/test.js";
const ContentTopic2 = "/myapp/1/latest/proto";

describe("Autosharding: Running Nodes", function () {
  this.timeout(50000);
  const clusterId = 10;
  let waku: LightNode;
  let nwaku: ServiceNode;
  let messageCollector: MessageCollector;

  beforeEachCustom(this, async () => {
    nwaku = new ServiceNode(makeLogFileName(this.ctx));
    messageCollector = new MessageCollector(nwaku);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  describe("Different clusters and topics", function () {
    // js-waku allows autosharding for cluster IDs different than 1
    it("Cluster ID 0 - Default/Global Cluster", async function () {
      const clusterId = 0;
      const pubsubTopics = [contentTopicToPubsubTopic(ContentTopic, clusterId)];
      await nwaku.start({
        store: true,
        lightpush: true,
        relay: true,
        clusterId: clusterId,
        pubsubTopic: pubsubTopics
      });

      await nwaku.ensureSubscriptions(pubsubTopics);

      waku = await createLightNode({
        networkConfig: {
          clusterId: clusterId,
          contentTopics: [ContentTopic]
        }
      });
      await waku.start();
      await waku.dial(await nwaku.getMultiaddrWithId());
      await waku.waitForPeers([Protocols.LightPush]);

      const encoder = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopicShardInfo: {
          clusterId: clusterId,
          shard: contentTopicToShardIndex(ContentTopic)
        }
      });

      const request = await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      expect(request.successes.length).to.eq(1);
      expect(
        await messageCollector.waitForMessagesAutosharding(1, {
          contentTopic: ContentTopic
        })
      ).to.eq(true);
    });

    it("Non TWN Cluster", async function () {
      const clusterId = 5;
      const pubsubTopics = [contentTopicToPubsubTopic(ContentTopic, clusterId)];
      await nwaku.start({
        store: true,
        lightpush: true,
        relay: true,
        clusterId: clusterId,
        pubsubTopic: pubsubTopics
      });

      await nwaku.ensureSubscriptions(pubsubTopics);

      waku = await createLightNode({
        networkConfig: {
          clusterId: clusterId,
          contentTopics: [ContentTopic]
        }
      });
      await waku.start();
      await waku.dial(await nwaku.getMultiaddrWithId());
      await waku.waitForPeers([Protocols.LightPush]);

      const encoder = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopicShardInfo: {
          clusterId: clusterId,
          shard: contentTopicToShardIndex(ContentTopic)
        }
      });

      const request = await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      expect(request.successes.length).to.eq(1);
      expect(
        await messageCollector.waitForMessagesAutosharding(1, {
          contentTopic: ContentTopic
        })
      ).to.eq(true);
    });

    const numTest = 10;
    for (let i = 0; i < numTest; i++) {
      // Random ContentTopic
      const applicationName = `app${Math.floor(Math.random() * 100)}`; // Random application name app0 to app99
      const version = Math.floor(Math.random() * 10) + 1; // Random version between 1 and 10
      const topicName = `topic${Math.floor(Math.random() * 1000)}`; // Random topic name topic0 to topic999
      const encodingList = ["proto", "json", "xml", "test.js", "utf8"]; // Potential encodings
      const encoding =
        encodingList[Math.floor(Math.random() * encodingList.length)]; // Random encoding
      const ContentTopic = `/${applicationName}/${version}/${topicName}/${encoding}`;

      it(`random auto sharding ${
        i + 1
      } - Cluster ID: ${clusterId}, Content Topic: ${ContentTopic}`, async function () {
        const pubsubTopics = [
          contentTopicToPubsubTopic(ContentTopic, clusterId)
        ];

        await nwaku.start({
          store: true,
          lightpush: true,
          relay: true,
          clusterId: clusterId,
          pubsubTopic: pubsubTopics,
          contentTopic: [ContentTopic]
        });

        waku = await createLightNode({
          networkConfig: {
            clusterId: clusterId,
            contentTopics: [ContentTopic]
          }
        });
        await waku.start();
        await waku.dial(await nwaku.getMultiaddrWithId());
        await waku.waitForPeers([Protocols.LightPush]);

        const encoder = createEncoder({
          contentTopic: ContentTopic,
          pubsubTopicShardInfo: {
            clusterId: clusterId,
            shard: contentTopicToShardIndex(ContentTopic)
          }
        });

        const request = await waku.lightPush.send(encoder, {
          payload: utf8ToBytes("Hello World")
        });

        expect(request.successes.length).to.eq(1);
        expect(
          await messageCollector.waitForMessagesAutosharding(1, {
            contentTopic: ContentTopic
          })
        ).to.eq(true);
      });
    }

    it("Wrong topic", async function () {
      const wrongTopic = "wrong_format";
      try {
        contentTopicToPubsubTopic(wrongTopic, clusterId);
        throw new Error("Wrong topic should've thrown an error");
      } catch (err) {
        if (
          !(err instanceof Error) ||
          !err.message.includes("Content topic format is invalid")
        ) {
          throw err;
        }
      }
    });
  });

  describe("Others", function () {
    it("configure the node with multiple content topics", async function () {
      const pubsubTopics = [
        contentTopicToPubsubTopic(ContentTopic, clusterId),
        contentTopicToPubsubTopic(ContentTopic2, clusterId)
      ];

      await nwaku.start({
        store: true,
        lightpush: true,
        relay: true,
        clusterId: clusterId,
        pubsubTopic: pubsubTopics,
        contentTopic: [ContentTopic, ContentTopic2]
      });

      waku = await createLightNode({
        networkConfig: {
          clusterId: clusterId,
          // For autosharding, we configure multiple pubsub topics by using two content topics that hash to different shards
          contentTopics: [ContentTopic, ContentTopic2]
        }
      });
      await waku.start();
      await waku.dial(await nwaku.getMultiaddrWithId());
      await waku.waitForPeers([Protocols.LightPush]);

      const encoder1 = createEncoder({
        contentTopic: ContentTopic,
        pubsubTopicShardInfo: {
          clusterId: clusterId,
          shard: contentTopicToShardIndex(ContentTopic)
        }
      });

      const encoder2 = createEncoder({
        contentTopic: ContentTopic2,
        pubsubTopicShardInfo: {
          clusterId: clusterId,
          shard: contentTopicToShardIndex(ContentTopic2)
        }
      });

      const request1 = await waku.lightPush.send(encoder1, {
        payload: utf8ToBytes("Hello World")
      });
      expect(request1.successes.length).to.eq(1);
      expect(
        await messageCollector.waitForMessagesAutosharding(1, {
          contentTopic: ContentTopic
        })
      ).to.eq(true);

      const request2 = await waku.lightPush.send(encoder2, {
        payload: utf8ToBytes("Hello World")
      });
      expect(request2.successes.length).to.eq(1);
      expect(
        await messageCollector.waitForMessagesAutosharding(1, {
          contentTopic: ContentTopic
        })
      ).to.eq(true);
    });

    it("using a protocol with unconfigured pubsub topic should fail", async function () {
      const pubsubTopics = [contentTopicToPubsubTopic(ContentTopic, clusterId)];
      await nwaku.start({
        store: true,
        lightpush: true,
        relay: true,
        clusterId: clusterId,
        pubsubTopic: pubsubTopics,
        contentTopic: [ContentTopic]
      });

      waku = await createLightNode({
        networkConfig: {
          clusterId: clusterId,
          contentTopics: [ContentTopic]
        }
      });
      await waku.start();

      // use a content topic that is not configured
      const encoder = createEncoder({
        contentTopic: ContentTopic2,
        pubsubTopicShardInfo: {
          clusterId: clusterId,
          shard: contentTopicToShardIndex(ContentTopic2)
        }
      });

      const { successes, failures } = await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      if (successes.length > 0 || failures?.length === 0) {
        throw new Error("The request should've thrown an error");
      }

      const errors = failures?.map((failure) => failure.error);
      expect(errors).to.include(ProtocolError.TOPIC_NOT_CONFIGURED);
    });

    it("start node with empty content topic", async function () {
      try {
        waku = await createLightNode({
          networkConfig: {
            clusterId: clusterId,
            contentTopics: []
          }
        });
        throw new Error(
          "Starting the node with no content topic should've thrown an error"
        );
      } catch (err) {
        if (
          !(err instanceof Error) ||
          !err.message.includes(
            "Invalid content topics configuration: please provide at least one content topic"
          )
        ) {
          throw err;
        }
      }
    });
  });
});
