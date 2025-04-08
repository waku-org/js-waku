import { createEncoder } from "@waku/core";
import { LightNode, Protocols } from "@waku/interfaces";
import { contentTopicToPubsubTopic } from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  MessageCollector,
  runMultipleNodes,
  ServiceNode,
  ServiceNodesFleet,
  tearDownNodes,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import { ClusterId, TestEncoder } from "./utils.js";

describe("Waku Light Push (Autosharding): Multiple PubsubTopics", function () {
  this.timeout(30000);
  const numServiceNodes = 2;

  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  const customEncoder2 = createEncoder({
    contentTopic: "/test/2/waku-light-push/utf8",
    pubsubTopic: contentTopicToPubsubTopic(
      "/test/2/waku-light-push/utf8",
      ClusterId
    )
  });

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      {
        clusterId: ClusterId,
        contentTopics: [TestEncoder.contentTopic, customEncoder2.contentTopic]
      },
      { lightpush: true, filter: true },
      false,
      numServiceNodes,
      false
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("Subscribe and receive messages on 2 different pubsubtopics", async function () {
    const pushResponse1 = await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("M1")
    });
    const pushResponse2 = await waku.lightPush.send(customEncoder2, {
      payload: utf8ToBytes("M2")
    });

    expect(pushResponse1.successes.length).to.eq(numServiceNodes);
    expect(pushResponse2.successes.length).to.eq(numServiceNodes);

    const messageCollector1 = new MessageCollector(serviceNodes.nodes[0]);
    const messageCollector2 = new MessageCollector(serviceNodes.nodes[1]);

    expect(
      await messageCollector1.waitForMessages(1, {
        pubsubTopic: TestEncoder.pubsubTopic
      })
    ).to.eq(true);

    expect(
      await messageCollector2.waitForMessages(1, {
        pubsubTopic: customEncoder2.pubsubTopic
      })
    ).to.eq(true);

    messageCollector1.verifyReceivedMessage(0, {
      expectedMessageText: "M1",
      expectedContentTopic: TestEncoder.contentTopic,
      expectedPubsubTopic: TestEncoder.pubsubTopic
    });

    messageCollector2.verifyReceivedMessage(0, {
      expectedMessageText: "M2",
      expectedContentTopic: customEncoder2.contentTopic,
      expectedPubsubTopic: customEncoder2.pubsubTopic
    });
  });

  it("Light push messages to 2 nwaku nodes each with different pubsubtopics", async function () {
    // Set up and start a new nwaku node with Default PubsubTopic
    const nwaku2 = new ServiceNode(makeLogFileName(this) + "3");

    try {
      await nwaku2.start({
        filter: true,
        lightpush: true,
        relay: true,
        pubsubTopic: [customEncoder2.pubsubTopic],
        clusterId: ClusterId
      });
      await nwaku2.ensureSubscriptionsAutosharding([
        customEncoder2.pubsubTopic
      ]);
      await waku.dial(await nwaku2.getMultiaddrWithId());
      await waku.waitForPeers([Protocols.LightPush]);

      const messageCollector2 = new MessageCollector(nwaku2);

      await waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes("M1")
      });
      await waku.lightPush.send(customEncoder2, {
        payload: utf8ToBytes("M2")
      });

      await serviceNodes.messageCollector.waitForMessages(1, {
        pubsubTopic: TestEncoder.pubsubTopic
      });
      await messageCollector2.waitForMessagesAutosharding(1, {
        contentTopic: customEncoder2.contentTopic
      });

      serviceNodes.messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: "M1",
        expectedContentTopic: TestEncoder.contentTopic,
        expectedPubsubTopic: TestEncoder.pubsubTopic
      });
      messageCollector2.verifyReceivedMessage(0, {
        expectedMessageText: "M2",
        expectedContentTopic: customEncoder2.contentTopic,
        expectedPubsubTopic: customEncoder2.pubsubTopic
      });
    } catch (e) {
      await tearDownNodes([nwaku2], []);
    }
  });
});
