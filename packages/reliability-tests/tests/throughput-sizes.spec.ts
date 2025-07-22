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

const ContentTopic = "/waku/2/content/test.throughput-sizes.js";

function generateRandomString(size: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let result = "";
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe("Throughput Sanity Checks - Different Message Sizes", function () {
  const testDurationMs = 20 * 60 * 1000; // 20 minute
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

  it("Send/Receive messages of varying sizes", async function () {
    const networkConfig = { clusterId: 0, numShardsInCluster: 8 };

    const testStart = new Date();
    const testEnd = Date.now() + testDurationMs;

    const sizes = [10, 100, 1000, 10_000, 100_000]; // bytes

    await nwaku.start(
      {
        store: true,
        filter: true,
        relay: true,
        clusterId: 0,
        shard: [0],
        contentTopic: [ContentTopic]
      },
      { retries: 3 }
    );

    await delay(1000);

    await nwaku.ensureSubscriptions([
      contentTopicToPubsubTopic(
        ContentTopic,
        networkConfig.clusterId,
        networkConfig.numShardsInCluster
      )
    ]);

    waku = await createLightNode({ networkConfig });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForPeers([Protocols.Filter]);

    const routingInfo = createRoutingInfo(networkConfig, {
      contentTopic: ContentTopic
    });
    const decoder = createDecoder(ContentTopic, routingInfo);
    const hasSubscribed = await waku.filter.subscribe(
      [decoder],
      messageCollector.callback
    );
    if (!hasSubscribed) throw new Error("Failed to subscribe from the start.");

    let messageId = 0;
    const report: {
      messageId: number;
      size: number;
      timestamp: string;
      sent: boolean;
      received: boolean;
      error?: string;
    }[] = [];

    while (Date.now() < testEnd) {
      const now = new Date();
      // Pick a random size from sizes array
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      const message = generateRandomString(size);
      let sent = false;
      let received = false;
      let err: string | undefined;

      try {
        await nwaku.sendMessage(
          ServiceNode.toMessageRpcQuery({
            contentTopic: ContentTopic,
            payload: utf8ToBytes(message)
          }),
          routingInfo
        );
        sent = true;

        received = await messageCollector.waitForMessages(1, {
          timeoutDuration: 3000
        });

        if (received) {
          messageCollector.verifyReceivedMessage(0, {
            expectedMessageText: message,
            expectedContentTopic: ContentTopic,
            expectedPubsubTopic: routingInfo.pubsubTopic
          });
        }
      } catch (e: any) {
        err = e.message || String(e);
      }

      report.push({
        messageId,
        size,
        timestamp: now.toISOString(),
        sent,
        received,
        error: err
      });

      messageId++;
      messageCollector.list = []; // clearing the message collector
      await delay(400);
    }

    const failedMessages = report.filter(
      (m) => !m.sent || !m.received || m.error
    );

    console.log("\n=== Throughput Sizes Test Summary ===");
    console.log("Start time:", testStart.toISOString());
    console.log("End time:", new Date().toISOString());
    console.log("Total messages:", report.length);
    console.log("Failures:", failedMessages.length);

    // Additional size info
    const sizeCounts: Record<number, number> = {};
    for (const entry of report) {
      sizeCounts[entry.size] = (sizeCounts[entry.size] || 0) + 1;
    }
    console.log("\nMessage size distribution:");
    for (const size of Object.keys(sizeCounts).sort(
      (a, b) => Number(a) - Number(b)
    )) {
      console.log(`Size ${size} bytes: ${sizeCounts[Number(size)]} messages`);
    }

    if (failedMessages.length > 0) {
      console.log("\n--- Failed Messages ---");
      for (const fail of failedMessages) {
        console.log(
          `#${fail.messageId} (size: ${fail.size} bytes) @ ${fail.timestamp} | sent: ${fail.sent} | received: ${fail.received} | error: ${fail.error || "N/A"}`
        );
      }
    }

    expect(
      failedMessages.length,
      `Some messages failed: ${failedMessages.length}`
    ).to.eq(0);
  });
});
