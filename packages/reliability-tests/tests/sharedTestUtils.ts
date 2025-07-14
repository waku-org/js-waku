import { execSync } from "child_process";

import { LightNode, Protocols } from "@waku/interfaces";
import {
  createDecoder,
  createEncoder,
  createLightNode,
  utf8ToBytes
} from "@waku/sdk";
import {
  delay,
  shardInfoToPubsubTopics,
  singleShardInfosToShardInfo,
  singleShardInfoToPubsubTopic
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

export interface TestContext {
  waku?: LightNode;
  nwaku?: ServiceNode;
  messageCollector?: MessageCollector;
}

/* eslint-disable no-console */

export function setupTest(ctx: Mocha.Suite, testContext: TestContext): void {
  beforeEachCustom(ctx, async () => {
    testContext.nwaku = new ServiceNode(makeLogFileName(ctx.ctx));
    testContext.messageCollector = new MessageCollector(testContext.nwaku);
  });

  afterEachCustom(ctx, async () => {
    if (testContext.nwaku && testContext.waku) {
      await tearDownNodes(testContext.nwaku, testContext.waku);
    }
  });
}

export interface RunTestOptions {
  testContext: TestContext;
  testDurationMs: number;
  testName: string;
  networkSetup?: () => Promise<void> | void;
  networkTeardown?: () => Promise<void> | void;
  messageGenerator?: (messageId: number) => string;
  messageTimeoutMs?: number;
  delayBetweenMessagesMs?: number;
}

export function runTest(options: RunTestOptions): void {
  const {
    testContext,
    testDurationMs,
    testName,
    networkSetup,
    networkTeardown,
    messageGenerator,
    delayBetweenMessagesMs = 400
  } = options;

  describe(testName, function () {
    this.timeout(testDurationMs * 1.1);

    beforeEach(async () => {
      if (networkSetup) {
        await networkSetup();
      }
    });

    afterEach(async () => {
      if (networkTeardown) {
        await networkTeardown();
      }
    });

    it(testName, async function () {
      const singleShardInfo = { clusterId: 0, shard: 0 };
      const shardInfo = singleShardInfosToShardInfo([singleShardInfo]);

      const contentTopic = "/waku/2/content/test.js";

      const testStart = new Date();
      const testEnd = Date.now() + testDurationMs;

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
          clusterId: 0,
          shard: [0],
          contentTopic: [contentTopic]
        },
        { retries: 3 }
      );

      await delay(1000);

      await testContext.nwaku!.ensureSubscriptions(
        shardInfoToPubsubTopics(shardInfo)
      );

      testContext.waku = await createLightNode({ networkConfig: shardInfo });
      await testContext.waku.start();
      await testContext.waku.dial(
        await testContext.nwaku!.getMultiaddrWithId()
      );
      await testContext.waku.waitForPeers([Protocols.Filter]);

      const decoder = createDecoder(contentTopic, singleShardInfo);
      const hasSubscribed = await testContext.waku.filter.subscribe(
        [decoder],
        testContext.messageCollector!.callback
      );
      if (!hasSubscribed)
        throw new Error("Failed to subscribe from the start.");

      const encoder = createEncoder({
        contentTopic,
        pubsubTopicShardInfo: singleShardInfo
      });

      expect(encoder.pubsubTopic).to.eq(
        singleShardInfoToPubsubTopic(singleShardInfo)
      );

      let messageId = 0;

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
            })
          );
          sent = true;

          received = await testContext.messageCollector!.waitForMessages(1, {
            timeoutDuration: 5000
          });

          if (received) {
            testContext.messageCollector!.verifyReceivedMessage(0, {
              expectedMessageText: message,
              expectedContentTopic: contentTopic,
              expectedPubsubTopic: shardInfoToPubsubTopics(shardInfo)[0]
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          err = e.message || String(e);
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
