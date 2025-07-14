import { generateRandomString, runTest, setupTest } from "./sharedTestUtils.js";

const sizes = [10, 100, 1000, 10_000, 100_000]; // bytes

describe("Throughput Sanity Checks - Different Message Sizes", function () {
  const testDurationMs = 1 * 60 * 1000; // 20 minute
  const testContext = {};

  setupTest(this, testContext);

  runTest({
    testContext: testContext,
    testDurationMs: testDurationMs,
    testName: "Throughput Sanity Checks - Different Message Sizes",
    messageGenerator: (_messageId: number) => {
      const size = sizes[Math.floor(Math.random() * sizes.length)];
      return generateRandomString(size);
    },
    delayBetweenMessagesMs: 400
  });
});
