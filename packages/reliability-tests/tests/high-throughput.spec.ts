import { LightNode, Protocols } from "@waku/interfaces";
import { createDecoder, createLightNode, utf8ToBytes } from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  createRoutingInfo,
  delay
} from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  MessageCollector,
  ServiceNode,
  tearDownNodes
} from "../../tests/src/index.js";

const ContentTopic = "/waku/2/content/test.high-throughput.js";
const NetworkConfig = { clusterId: 0, numShardsInCluster: 8 };
const RoutingInfo = createRoutingInfo(NetworkConfig, {
  contentTopic: ContentTopic
});

describe("High Throughput Messaging", function () {
  const testDurationMs = 20 * 60 * 1000; // 20 minutes
  this.timeout(testDurationMs * 1.1);
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

  it("Send/Receive thousands of messages quickly", async function () {
    const testStart = new Date();
    const testEnd = Date.now() + testDurationMs;

    const report: {
      messageId: number;
      timestamp: string;
      sent: boolean;
      received: boolean;
      error?: string;
    }[] = [];

    await nwaku.start(
      {
        store: true,
        filter: true,
        relay: true,
        clusterId: NetworkConfig.clusterId,
        numShardsInNetwork: NetworkConfig.numShardsInCluster,
        contentTopic: [ContentTopic]
      },
      { retries: 3 }
    );

    await delay(1000);

    await nwaku.ensureSubscriptions([
      contentTopicToPubsubTopic(
        ContentTopic,
        NetworkConfig.clusterId,
        NetworkConfig.numShardsInCluster
      )
    ]);

    waku = await createLightNode({ networkConfig: NetworkConfig });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForPeers([Protocols.Filter]);

    const decoder = createDecoder(ContentTopic, RoutingInfo);
    const hasSubscribed = await waku.filter.subscribe(
      [decoder],
      messageCollector.callback
    );
    if (!hasSubscribed) throw new Error("Failed to subscribe from the start.");

    let messageId = 0;

    // Send messages as fast as possible until testEnd
    while (Date.now() < testEnd) {
      const now = new Date();
      const message = `msg-${messageId}`;
      let sent = false;
      let received = false;
      let err: string | undefined;

      try {
        await nwaku.sendMessage(
          ServiceNode.toMessageRpcQuery({
            contentTopic: ContentTopic,
            payload: utf8ToBytes(message)
          }),
          RoutingInfo
        );
        sent = true;

        received = await messageCollector.waitForMessages(1, {
          timeoutDuration: 2000
        });

        if (received) {
          messageCollector.verifyReceivedMessage(0, {
            expectedMessageText: message,
            expectedContentTopic: ContentTopic,
            expectedPubsubTopic: RoutingInfo.pubsubTopic
          });
        }
      } catch (e: any) {
        err = e.message || String(e);
      }

      report.push({
        messageId,
        timestamp: now.toISOString(),
        sent,
        received,
        error: err
      });

      messageId++;
      messageCollector.list = []; // clearing the message collector
    }

    const failedMessages = report.filter(
      (m) => !m.sent || !m.received || m.error
    );

    console.log("\n=== High Throughput Test Summary ===");
    console.log("Start time:", testStart.toISOString());
    console.log("End time:", new Date().toISOString());
    console.log("Total messages:", report.length);
    console.log("Failures:", failedMessages.length);

    if (failedMessages.length > 0) {
      console.log("\n--- Failed Messages ---");
      for (const fail of failedMessages) {
        console.log(
          `#${fail.messageId} @ ${fail.timestamp} | sent: ${fail.sent} | received: ${fail.received} | error: ${fail.error || "N/A"}`
        );
      }
    }

    expect(
      failedMessages.length,
      `Some messages failed: ${failedMessages.length}`
    ).to.eq(0);
  });
});
