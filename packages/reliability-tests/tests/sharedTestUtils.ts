import { execSync } from "child_process";

import { AutoSharding, LightNode, Protocols } from "@waku/interfaces";
import {
  createDecoder,
  createEncoder,
  createLightNode,
  utf8ToBytes
} from "@waku/sdk";
import { createRoutingInfo, delay } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  MessageCollector,
  ServiceNode,
  tearDownNodes
} from "../../tests/src/index.js";
import { singleShardInfoToPubsubTopic } from "../../utils/dist/common/sharding";

export interface TestContext {
  waku?: LightNode;
  nwaku?: ServiceNode;
  messageCollector?: MessageCollector;
  report?: Array<{
    messageId: number;
    size?: number;
    timestamp: string;
    sent: boolean;
    received: boolean;
    error?: string;
  }>;
}

/* eslint-disable no-console */

export function setupTest(ctx: Mocha.Suite, testContext: TestContext): void {
  beforeEachCustom(ctx, async () => {
    testContext.nwaku = new ServiceNode(makeLogFileName(ctx.ctx));
    testContext.messageCollector = new MessageCollector();
  });

  afterEachCustom(ctx, async () => {
    if (testContext.nwaku && testContext.waku) {
      await tearDownNodes(testContext.nwaku, testContext.waku);
    }
  });
}

export function printSizeDistributionReport(
  report: TestContext["report"]
): void {
  if (!report) return;

  const sizes = report.map((r) => r.size ?? 0);
  const sizesSet = new Set(sizes);
  if (sizesSet.size <= 1) return; // Only one size, no need to print distribution

  const buckets = [10, 100, 1000, 10000, 100000];
  const sizeCounts: Record<number, number> = {};
  for (const entry of report) {
    if (entry.size !== undefined) {
      // Find closest bucket
      let closest = buckets[0];
      let minDiff = Math.abs(entry.size - buckets[0]);
      for (const b of buckets) {
        const diff = Math.abs(entry.size - b);
        if (diff < minDiff) {
          minDiff = diff;
          closest = b;
        }
      }
      sizeCounts[closest] = (sizeCounts[closest] || 0) + 1;
    }
  }
  console.log("\nMessage size distribution (mapped to fixed buckets):");
  for (const size of buckets) {
    console.log(`Size ${size} bytes: ${sizeCounts[size] || 0} messages`);
  }
}

export interface RunTestOptions {
  testContext: TestContext;
  testDurationMs: number;
  testName: string;
  messageGenerator?: (messageId: number) => string;
  messageTimeoutMs?: number;
  delayBetweenMessagesMs?: number;
}

export function runTest(options: RunTestOptions): void {
  const {
    testContext,
    testDurationMs,
    testName,
    messageGenerator,
    delayBetweenMessagesMs = 400
  } = options;

  describe(testName, function () {
    this.timeout(testDurationMs * 1.1); // Timing out if test runs for 10% more than expected. Used to avoid hangs and freezes

    it(testName, async function () {
      const clusterId = 2;
      const shards = [1];
      const numShardsInCluster = 8;

      const singleShardInfo = { clusterId: clusterId, shard: shards[0] };

      const contentTopic = "/waku/2/content/test.js";

      const testStart = new Date();
      const testEnd = Date.now() + testDurationMs;

      const testNetworkConfig: AutoSharding = {
        clusterId: clusterId,
        numShardsInCluster: numShardsInCluster
      };
      const testRoutingInfo = createRoutingInfo(testNetworkConfig, {
        contentTopic: contentTopic
      });

      const report: {
        messageId: number;
        size?: number;
        timestamp: string;
        sent: boolean;
        received: boolean;
        error?: string;
      }[] = [];

      await testContext.nwaku!.start(
        {
          store: true,
          filter: true,
          relay: true,
          clusterId,
          shard: shards,
          numShardsInNetwork: numShardsInCluster,
          contentTopic: [contentTopic]
        },
        { retries: 3 }
      );

      await delay(1000);

      await testContext.nwaku!.ensureSubscriptions([
        singleShardInfoToPubsubTopic(singleShardInfo)
      ]);

      testContext.waku = await createLightNode({
        networkConfig: { clusterId, numShardsInCluster }
      });
      await testContext.waku.start();
      await testContext.waku.dial(
        await testContext.nwaku!.getMultiaddrWithId()
      );
      await testContext.waku.waitForPeers([Protocols.Filter]);

      const decoder = createDecoder(contentTopic, {
        clusterId: singleShardInfo.clusterId,
        shardId: singleShardInfo.shard,
        pubsubTopic: singleShardInfoToPubsubTopic(singleShardInfo)
      });
      const hasSubscribed = await testContext.waku.filter.subscribe(
        [decoder],
        testContext.messageCollector!.callback
      );
      if (!hasSubscribed)
        throw new Error("Failed to subscribe from the start.");

      const encoder = createEncoder({
        contentTopic,
        routingInfo: {
          clusterId: singleShardInfo.clusterId,
          shardId: singleShardInfo.shard,
          pubsubTopic: singleShardInfoToPubsubTopic(singleShardInfo)
        }
      });

      expect(encoder.pubsubTopic).to.eq(
        singleShardInfoToPubsubTopic(singleShardInfo)
      );

      let messageId = 0;

      console.log("Received messages via filter:");

      while (Date.now() < testEnd) {
        const now = new Date();
        const message = messageGenerator
          ? messageGenerator(messageId)
          : `ping-${messageId}`;
        let sent = false;
        let received = false;
        let err: string | undefined;

        try {
          await testContext.nwaku!.sendMessage(
            ServiceNode.toMessageRpcQuery({
              contentTopic,
              payload: utf8ToBytes(message)
            }),
            testRoutingInfo
          );
          sent = true;

          received = await testContext.messageCollector!.waitForMessages(1, {
            timeoutDuration: 5000
          });

          if (received) {
            testContext.messageCollector!.verifyReceivedMessage(0, {
              expectedMessageText: message,
              expectedContentTopic: contentTopic,
              expectedPubsubTopic: singleShardInfoToPubsubTopic(singleShardInfo)
            });
          }

          console.log(
            JSON.stringify(testContext.messageCollector!.getMessage(0))
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          err = e.message || String(e);
          console.log(`Issue/Error/Failure for message: ${String(e)}`);
        }

        report.push({
          messageId,
          size: message.length,
          timestamp: now.toISOString(),
          sent,
          received,
          error: err
        });

        messageId++;
        testContext.messageCollector!.list = []; // clearing the message collector
        await delay(delayBetweenMessagesMs);
      }

      testContext.report = report;

      const failedMessages = report.filter(
        (m) => !m.sent || !m.received || m.error
      );

      console.log(`\n=== ${testName} Summary ===`);
      console.log("Start time:", testStart.toISOString());
      console.log("End time:", new Date().toISOString());
      console.log("Total messages:", report.length);
      console.log("Failures:", failedMessages.length);

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
}

export function generateRandomString(size: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let result = "";
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function execCommand(command: string): void {
  try {
    execSync(command);
  } catch (e) {
    console.warn(
      `Failed to execute command "${command}", continuing without it:`,
      e
    );
  }
}

/* eslint-enable no-console */
