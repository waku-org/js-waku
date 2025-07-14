import { execCommand, runTest, setupTest } from "./sharedTestUtils.js";

describe("Low Bandwith Test", function () {
  const testDurationMs = 10 * 60 * 1000; // 10 mins
  const testContext = {};

  setupTest(this, testContext);

  const networkSetup = (): void =>
    execCommand(
      `sudo tc qdisc add dev eth0 root tbf rate 1mbit burst 32kbit limit 12500`
    );
  const networkTeardown = (): void =>
    execCommand("sudo tc qdisc del dev eth0 root");

  runTest({
    testContext: testContext,
    testDurationMs: testDurationMs,
    testName: "Low Bandwith Test",
    networkSetup,
    networkTeardown,
    messageGenerator: (messageId: number) => `ping-${messageId}`,
    delayBetweenMessagesMs: 400
  });
});
