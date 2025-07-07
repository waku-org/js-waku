import { LightNode, Protocols } from "@waku/interfaces";
import { createDecoder, createLightNode, utf8ToBytes } from "@waku/sdk";
import {
  delay,
  shardInfoToPubsubTopics,
  singleShardInfosToShardInfo
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

const ContentTopic = "/waku/2/content/test.js";

describe("Longevity", function () {
  const testDurationMs = 2 * 60 * 60 * 1000; // 2 hours
  this.timeout(testDurationMs + 5 * 60 * 1000);
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

  it("Filter - 2 hours", async function () {
    const singleShardInfo = { clusterId: 0, shard: 0 };
    const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);

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
        clusterId: 0,
        shard: [0],
        contentTopic: [ContentTopic]
      },
      { retries: 3 }
    );

    await nwaku.ensureSubscriptions(shardInfoToPubsubTopics(shardInfo));

    waku = await createLightNode({ networkConfig: shardInfo });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waku.waitForPeers([Protocols.Filter]);

    const decoder = createDecoder(ContentTopic, singleShardInfo);
    const hasSubscribed = await waku.filter.subscribe(
      [decoder],
      messageCollector.callback
    );
    if (!hasSubscribed) throw new Error("Failed to subscribe from the start.");

    let messageId = 0;

    while (Date.now() < testEnd) {
      const now = new Date();
      const message = `ping-${messageId}`;
      let sent = false;
      let received = false;
      let err: string | undefined;

      try {
        await nwaku.sendMessage(
          ServiceNode.toMessageRpcQuery({
            contentTopic: ContentTopic,
            payload: utf8ToBytes(message)
          })
        );
        sent = true;

        received = await messageCollector.waitForMessages(1, {
          timeoutDuration: 5000
        });

        if (received) {
          messageCollector.verifyReceivedMessage(0, {
            expectedMessageText: message,
            expectedContentTopic: ContentTopic,
            expectedPubsubTopic: shardInfoToPubsubTopics(shardInfo)[0]
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
      await delay(400);
    }

    const failedMessages = report.filter(
      (m) => !m.sent || !m.received || m.error
    );

    console.log("\n=== Longevity Test Summary ===");
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
