import { runTest, setupTest } from "./sharedTestUtils.js";

describe("High Throughput Messaging", function () {
  const testDurationMs = 20 * 60 * 1000; // 20 minutes
  const testContext = {};

  setupTest(this, testContext);

  runTest({
    testContext: testContext,
    testDurationMs: testDurationMs,
    testName: "High Throughput Messaging",
    messageGenerator: (messageId: number) => `High-Throughput-${messageId}`,
    delayBetweenMessagesMs: 0
  });
});
