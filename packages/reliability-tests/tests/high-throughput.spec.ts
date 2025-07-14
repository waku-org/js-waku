import { runTest, setupTest } from "./sharedTestUtils.js";

const ContentTopic = "/waku/2/content/test.high-throughput.js";

describe("High Throughput Messaging", function () {
  const testDurationMs = 20 * 60 * 1000; // 20 minutes
  const testContext = {};

  setupTest(this, testContext);

  runTest(
    testContext,
    ContentTopic,
    testDurationMs,
    "High Throughput Messaging",
    undefined,
    undefined,
    (messageId) => `msg-${messageId}`,
    2000,
    0
  );
});
