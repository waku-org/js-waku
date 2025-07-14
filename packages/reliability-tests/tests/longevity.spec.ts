import { runTest, setupTest } from "./sharedTestUtils.js";

describe("Longevity", function () {
  const testDurationMs = 1 * 60 * 1000; // 2 hours
  const testContext = {};

  setupTest(this, testContext);

  runTest({
    testContext: testContext,
    testDurationMs: testDurationMs,
    testName: "Longevity",
    messageGenerator: (messageId: number) => `ping-${messageId}`,
    delayBetweenMessagesMs: 400
  });
});
