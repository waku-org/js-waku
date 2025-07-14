import { execCommand, runTest, setupTest } from "./sharedTestUtils.js";

describe("Packet Loss Test", function () {
  const testDurationMs = 10 * 60 * 1000; // 10 mins
  const testContext = {};

  setupTest(this, testContext);

  beforeEach(async () => {
    execCommand("sudo tc qdisc add dev eth0 root netem loss 2%");
  });

  afterEach(async () => {
    execCommand("sudo tc qdisc del dev eth0 root netem");
  });

  runTest({
    testContext: testContext,
    testDurationMs: testDurationMs,
    testName: "Packet Loss Test",
    messageGenerator: (messageId: number) => `ping-${messageId}`,
    delayBetweenMessagesMs: 400
  });
});
