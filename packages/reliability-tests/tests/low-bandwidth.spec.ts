import { execCommand, runTest, setupTest } from "./sharedTestUtils.js";

const ContentTopic = "/waku/2/content/test.js";

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

  runTest(
    testContext,
    ContentTopic,
    testDurationMs,
    "Low Bandwith Test",
    networkSetup,
    networkTeardown,
    (messageId) => `ping-${messageId}`,
    5000,
    400
  );
});
