import { LightNode, ProtocolError } from "@waku/interfaces";
import { createEncoder, createLightNode, utf8ToBytes } from "@waku/sdk";
import { contentTopicToPubsubTopic, determinePubsubTopic } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

const ContentTopic = "/waku/2/content/test.js";
const ContentTopic2 = "/myapp/1/latest/proto";

describe("Autosharding: Running Nodes", function () {
  this.timeout(50000);
  const clusterId = 10;
  const numServiceNodes = 2;

  let waku: LightNode | undefined = undefined;
  let serviceNodes: ServiceNodesFleet | undefined = undefined;

  afterEachCustom(this, async () => {
    if (serviceNodes) {
      await teardownNodesWithRedundancy(serviceNodes, waku ?? []);
    }
  });

  // js-waku allows autosharding for cluster IDs different than 1
  it("Cluster ID 0 - Default/Global Cluster", async function () {
    const clusterId = 0;

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      { clusterId, contentTopics: [ContentTopic] },
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: determinePubsubTopic(encoder.contentTopic, clusterId)
      })
    ).to.eq(true);
  });

  it("Non TWN Cluster", async function () {
    const clusterId = 5;

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      { clusterId, contentTopics: [ContentTopic] },
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: determinePubsubTopic(ContentTopic, clusterId)
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
      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        { clusterId, contentTopics: [ContentTopic] },
        { lightpush: true, filter: true },
        false,
        numServiceNodes,
        true
      );

      const encoder = createEncoder({
        contentTopic: ContentTopic
      });

      const request = await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      expect(request.successes.length).to.eq(numServiceNodes);
      expect(
        await serviceNodes.messageCollector.waitForMessages(1, {
          pubsubTopic: determinePubsubTopic(ContentTopic, clusterId)
        })
      ).to.eq(true);
    });
  }

  // TODO: replace with unit tests
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

  it("configure the node with multiple content topics", async function () {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      { clusterId, contentTopics: [ContentTopic, ContentTopic2] },
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder1 = createEncoder({
      contentTopic: ContentTopic
    });

    const encoder2 = createEncoder({
      contentTopic: ContentTopic2
    });

    const request1 = await waku.lightPush.send(encoder1, {
      payload: utf8ToBytes("Hello World")
    });
    expect(request1.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: determinePubsubTopic(ContentTopic, clusterId)
      })
    ).to.eq(true);

    const request2 = await waku.lightPush.send(encoder2, {
      payload: utf8ToBytes("Hello World")
    });
    expect(request2.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: determinePubsubTopic(ContentTopic, clusterId)
      })
    ).to.eq(true);
  });

  it("using a protocol with unconfigured pubsub topic should fail", async function () {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      { clusterId, contentTopics: [ContentTopic] },
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    // use a content topic that is not configured
    const encoder = createEncoder({
      contentTopic: ContentTopic2
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
