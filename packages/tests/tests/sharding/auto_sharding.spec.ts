import { AutoSharding, LightNode } from "@waku/interfaces";
import { createEncoder, utf8ToBytes } from "@waku/sdk";
import { contentTopicToPubsubTopic, createRoutingInfo } from "@waku/utils";
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
    const networkConfig: AutoSharding = { clusterId, numShardsInCluster: 8 };
    const routingInfo = createRoutingInfo(networkConfig, {
      contentTopic: ContentTopic
    });

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      routingInfo,
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic,
      routingInfo
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
  });

  it("Non TWN Cluster", async function () {
    const clusterId = 5;
    const networkConfig: AutoSharding = { clusterId, numShardsInCluster: 10 };
    const routingInfo = createRoutingInfo(networkConfig, {
      contentTopic: ContentTopic
    });

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      routingInfo,
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      true
    );

    const encoder = createEncoder({
      contentTopic: ContentTopic,
      routingInfo
    });

    const request = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    expect(request.successes.length).to.eq(numServiceNodes);
    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
  });

  const numTest = 2;
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
      const networkConfig: AutoSharding = { clusterId, numShardsInCluster: 8 };
      const routingInfo = createRoutingInfo(networkConfig, {
        contentTopic: ContentTopic
      });

      [serviceNodes, waku] = await runMultipleNodes(
        this.ctx,
        routingInfo,
        { lightpush: true, filter: true },
        false,
        numServiceNodes,
        true
      );

      const encoder = createEncoder({
        contentTopic: ContentTopic,
        routingInfo
      });

      const request = await waku.lightPush.send(encoder, {
        payload: utf8ToBytes("Hello World")
      });

      expect(request.successes.length).to.eq(numServiceNodes);
      expect(
        await serviceNodes.messageCollector.waitForMessages(1, {
          contentTopic: ContentTopic
        })
      ).to.eq(true);
    });
  }

  // TODO: replace with unit tests
  it("Wrong topic", async function () {
    const wrongTopic = "wrong_format";
    try {
      contentTopicToPubsubTopic(wrongTopic, clusterId, 8);
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
    const networkConfig: AutoSharding = { clusterId, numShardsInCluster: 8 };
    const routingInfo = createRoutingInfo(networkConfig, {
      contentTopic: ContentTopic
    });

    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      routingInfo,
      {
        lightpush: true,
        filter: true,
        contentTopic: [ContentTopic, ContentTopic2]
      },
      false,
      numServiceNodes,
      true
    );

    const encoder1 = createEncoder({
      contentTopic: ContentTopic,
      routingInfo
    });

    const encoder2 = createEncoder({
      contentTopic: ContentTopic2,
      routingInfo: createRoutingInfo(networkConfig, {
        contentTopic: ContentTopic2
      })
    });

    const request1 = await waku.lightPush.send(encoder1, {
      payload: utf8ToBytes("Hello World")
    });
    expect(request1.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        contentTopic: ContentTopic
      })
    ).to.eq(true);

    const request2 = await waku.lightPush.send(encoder2, {
      payload: utf8ToBytes("Hello World")
    });
    expect(request2.successes.length).to.eq(numServiceNodes);
    expect(
      await serviceNodes.messageCollector.waitForMessages(1, {
        contentTopic: ContentTopic2
      })
    ).to.eq(true);
  });
});
