import { execCommand, runTest, setupTest } from "./sharedTestUtils.js";

describe("Low Bandwith Test", function () {
  const testDurationMs = 10 * 60 * 1000; // 10 mins
  const testContext = {};

  setupTest(this, testContext);

  beforeEach(async () => {
    execCommand(
      "sudo tc qdisc add dev eth0 root tbf rate 1mbit burst 32kbit limit 12500"
    );
  });

  afterEach(async () => {
    execCommand("sudo tc qdisc del dev eth0 root");
  });

  runTest({
    testContext: testContext,
    testDurationMs: testDurationMs,
    testName: "Low Bandwith Test",
    messageGenerator: (messageId: number) => `ping-${messageId}`,
    delayBetweenMessagesMs: 400
  });
});
