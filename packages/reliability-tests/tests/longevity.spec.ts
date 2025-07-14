import { runTest, setupTest } from "./sharedTestUtils.js";

const ContentTopic = "/waku/2/content/test.js";

describe("Longevity", function () {
  const testDurationMs = 2 * 60 * 60 * 1000; // 2 hours
  const testContext = {};

  setupTest(this, testContext);

  runTest(
    testContext,
    ContentTopic,
    testDurationMs,
    "Longevity",
    undefined,
    undefined,
    (messageId) => `ping-${messageId}`,
    5000,
    400
  );
});
