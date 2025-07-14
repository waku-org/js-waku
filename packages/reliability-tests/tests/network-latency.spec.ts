import { execCommand, runTest, setupTest } from "./sharedTestUtils.js";

describe("Network Latency and Jitter Test", function () {
  const testDurationMs = 10 * 60 * 1000; // 10 mins
  const testContext = {};

  setupTest(this, testContext);

  const networkSetup = (): void =>
    execCommand(
      `sudo tc qdisc add dev eth0 root netem delay 300ms 50ms distribution normal`
    );
  const networkTeardown = (): void =>
    execCommand("sudo tc qdisc del dev eth0 root netem");

  runTest({
    testContext: testContext,
    testDurationMs: testDurationMs,
    testName: "Network Latency and Jitter Test",
    networkSetup,
    networkTeardown,
    messageGenerator: (messageId: number) => `ping-${messageId}`,
    delayBetweenMessagesMs: 400
  });
});
