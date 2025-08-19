/**
 * Advanced test builders to create complete test suites with minimal code
 * This demonstrates the highest level of code reduction and reusability
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../lib/index.js";

import {
  createTestSuiteDescription,
  createTestUtilities,
  testSingleMessage,
  testSubscription,
  TestUtilities,
  verifyConnections
} from "./index.js";

/**
 * Configuration for building test suites
 */
export interface TestSuiteConfig {
  protocol: string;
  timeout?: number;
  strictCheck?: boolean;
  nodeCount?: number;
}

/**
 * Build a complete standard test suite for any protocol
 */
export function buildStandardTestSuite(config: TestSuiteConfig): void {
  const utilities = createTestUtilities(config.protocol);
  const runTests = (strictCheckNodes: boolean): void => {
    describe(
      createTestSuiteDescription(
        config.protocol,
        "Standard Tests",
        `Strict Check: ${strictCheckNodes}`
      ),
      function () {
        this.timeout(config.timeout || 100000);
        let waku: any;
        let serviceNodes: ServiceNodesFleet;

        beforeEachCustom(this, async () => {
          [serviceNodes, waku] = await runMultipleNodes(
            this.ctx,
            utilities.routingInfo,
            undefined,
            strictCheckNodes,
            config.nodeCount || 2
          );
        });

        afterEachCustom(this, async () => {
          await teardownNodesWithRedundancy(serviceNodes, waku);
        });

        it("Subscribe and receive single message", async function () {
          verifyConnections(waku, config.nodeCount || 2);
          await testSubscription({ serviceNodes, waku }, utilities);
        });

        it("Send and receive message with custom payload", async function () {
          await testSingleMessage({ serviceNodes, waku }, utilities, {
            payload: new TextEncoder().encode("Custom test message")
          });
        });
      }
    );
  };

  [true, false].map(runTests);
}

/**
 * Build subscription-focused test suite
 */
export function buildSubscriptionTestSuite(
  protocol: string,
  customTests?: (utilities: TestUtilities, setup: any) => void
): void {
  const utilities = createTestUtilities(protocol);

  describe(
    createTestSuiteDescription(protocol, "Subscription Tests"),
    function () {
      this.timeout(100000);
      let waku: any;
      let serviceNodes: ServiceNodesFleet;

      beforeEachCustom(this, async () => {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          utilities.routingInfo
        );
      });

      afterEachCustom(this, async () => {
        await teardownNodesWithRedundancy(serviceNodes, waku);
      });

      it("Basic subscription and message receipt", async function () {
        await testSubscription({ serviceNodes, waku }, utilities);
      });

      it("Multiple messages on same subscription", async function () {
        await waku.filter.subscribe(
          utilities.decoder,
          serviceNodes.messageCollector.callback
        );

        // Send multiple messages
        for (let i = 0; i < 3; i++) {
          await waku.lightPush.send(utilities.encoder, {
            payload: new TextEncoder().encode(`Message ${i}`)
          });
        }

        expect(await serviceNodes.messageCollector.waitForMessages(3)).to.eq(
          true
        );
      });

      // Run custom tests if provided
      if (customTests) {
        customTests(utilities, { waku, serviceNodes });
      }
    }
  );
}

/**
 * Build performance-focused test suite
 */
export function buildPerformanceTestSuite(
  protocol: string,
  messageCount: number = 50
): void {
  const utilities = createTestUtilities(protocol);

  describe(
    createTestSuiteDescription(protocol, "Performance Tests"),
    function () {
      this.timeout(300000); // 5 minutes for performance tests
      let waku: any;
      let serviceNodes: ServiceNodesFleet;

      beforeEachCustom(this, async () => {
        [serviceNodes, waku] = await runMultipleNodes(
          this.ctx,
          utilities.routingInfo
        );
      });

      afterEachCustom(this, async () => {
        await teardownNodesWithRedundancy(serviceNodes, waku);
      });

      it(`Send and receive ${messageCount} messages`, async function () {
        await waku.filter.subscribe(
          utilities.decoder,
          serviceNodes.messageCollector.callback
        );

        const startTime = Date.now();

        // Send messages rapidly
        for (let i = 0; i < messageCount; i++) {
          await waku.lightPush.send(utilities.encoder, {
            payload: new TextEncoder().encode(`Perf message ${i}`)
          });
        }

        // Wait for all messages
        expect(
          await serviceNodes.messageCollector.waitForMessages(messageCount)
        ).to.eq(true);

        const endTime = Date.now();
        const duration = endTime - startTime;
        // eslint-disable-next-line no-console
        console.log(`Processed ${messageCount} messages in ${duration}ms`);

        // Basic performance assertion (adjust as needed)
        expect(duration).to.be.lessThan(messageCount * 100); // 100ms per message max
      });
    }
  );
}

/**
 * Example usage that would replace multiple test files:
 *
 * // Instead of writing 50+ lines of boilerplate for each protocol:
 * buildStandardTestSuite({ protocol: "filter" });
 * buildStandardTestSuite({ protocol: "lightpush" });
 * buildStandardTestSuite({ protocol: "store" });
 *
 * // Custom tests for specific needs:
 * buildSubscriptionTestSuite("filter", (utilities, { waku, serviceNodes }) => {
 *   it("Custom filter-specific test", async function() {
 *     // Custom test logic here
 *   });
 * });
 */
