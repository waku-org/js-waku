import { execCommand, runTest, setupTest } from "./sharedTestUtils.js";

const ContentTopic = "/waku/2/content/test.js";

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

  runTest(
    testContext,
    ContentTopic,
    testDurationMs,
    "Network Latency and Jitter Test",
    networkSetup,
    networkTeardown,
    (messageId) => `ping-${messageId}`,
    5000,
    400
  );
});
