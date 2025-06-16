import { createDecoder, createEncoder } from "@waku/core";
import {
  CreateNodeOptions,
  DefaultNetworkConfig,
  INextFilter,
  IWaku,
  LightNode,
  NetworkConfig,
  Protocols
} from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  contentTopicToShardIndex,
  derivePubsubTopicsFromNetworkConfig,
  Logger
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { Context } from "mocha";
import pRetry from "p-retry";

import {
  delay,
  NOISE_KEY_1,
  ServiceNodesFleet,
  waitForConnections
} from "../../src/index.js";

// Constants for test configuration.
export const log = new Logger("test:filter");
export const TestContentTopic = "/test/1/waku-filter/default";
export const ClusterId = 2;
export const ShardIndex = contentTopicToShardIndex(TestContentTopic);
export const TestShardInfo = {
  contentTopics: [TestContentTopic],
  clusterId: ClusterId
};
export const TestPubsubTopic = contentTopicToPubsubTopic(
  TestContentTopic,
  ClusterId
);
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  pubsubTopic: TestPubsubTopic
});
export const TestDecoder = createDecoder(TestContentTopic, TestPubsubTopic);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

// Optimized version with connection pooling
export class OptimizedFilterTestContext {
  private static instance: OptimizedFilterTestContext | null = null;
  private serviceNodes: ServiceNodesFleet | null = null;
  private waku: LightNode | null = null;
  private initialized = false;

  public static async getInstance(
    context: Context,
    networkConfig: NetworkConfig = DefaultNetworkConfig,
    strictChecking: boolean = false,
    numServiceNodes = 2,
    forceNew = false
  ): Promise<OptimizedFilterTestContext> {
    if (!this.instance || forceNew) {
      this.instance = new OptimizedFilterTestContext();
      await this.instance.initialize(
        context,
        networkConfig,
        strictChecking,
        numServiceNodes
      );
    }
    return this.instance;
  }

  private async initialize(
    context: Context,
    networkConfig: NetworkConfig,
    strictChecking: boolean,
    numServiceNodes: number
  ): Promise<void> {
    if (this.initialized) return;

    const pubsubTopics = derivePubsubTopicsFromNetworkConfig(networkConfig);

    // Create service nodes
    this.serviceNodes = await ServiceNodesFleet.createAndRun(
      context,
      numServiceNodes,
      strictChecking,
      networkConfig,
      undefined,
      false
    );

    // Create waku node
    const wakuOptions: CreateNodeOptions = {
      staticNoiseKey: NOISE_KEY_1,
      libp2p: {
        addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] }
      },
      networkConfig
    };

    log.info("Starting js waku node with optimized config");
    this.waku = await createLightNode(wakuOptions);
    await this.waku.start();

    // Connect to all nodes in parallel
    const connectionPromises = this.serviceNodes.nodes.map(async (node) => {
      await this.waku!.dial(await node.getMultiaddrWithId());
      await node.ensureSubscriptions(pubsubTopics);
    });

    await Promise.all(connectionPromises);
    await this.waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);
    await waitForConnections(numServiceNodes, this.waku);

    this.initialized = true;
  }

  public async resetForTest(): Promise<[ServiceNodesFleet, LightNode]> {
    if (!this.serviceNodes || !this.waku) {
      throw new Error("Context not initialized");
    }

    // Clear message collectors - just reset the message list
    // The messageCollector is a MultipleNodesMessageCollector that aggregates messages
    // We can't easily reset it, so we'll rely on test isolation

    // Clear subscriptions
    if (this.waku.nextFilter) {
      try {
        await (this.waku.nextFilter as any).unsubscribeAll();
      } catch (e) {
        log.warn("Failed to clear subscriptions", e);
      }
    }

    return [this.serviceNodes, this.waku];
  }

  public async cleanup(): Promise<void> {
    if (this.serviceNodes && this.waku) {
      await teardownNodesWithRedundancy(this.serviceNodes, this.waku);
    }
    this.initialized = false;
    OptimizedFilterTestContext.instance = null;
  }
}

// Optimized subscription wait
export async function waitForSubscriptionReady(
  _nextFilter: INextFilter,
  maxWait = 100
): Promise<void> {
  // For nextFilter, we just wait a bit as it doesn't have ping
  await delay(Math.min(maxWait, 50));
}

// Parallel message sending
export async function sendMessagesInParallel(
  waku: LightNode,
  messages: Array<{
    encoder: any;
    payload: Uint8Array;
  }>
): Promise<void> {
  const sendPromises = messages.map((msg) =>
    waku.lightPush.send(msg.encoder, { payload: msg.payload })
  );
  await Promise.all(sendPromises);
}

// Optimized teardown function
export async function teardownNodesWithRedundancy(
  serviceNodes: ServiceNodesFleet,
  wakuNodes: IWaku | IWaku[]
): Promise<void> {
  const wNodes = Array.isArray(wakuNodes) ? wakuNodes : [wakuNodes];

  // Stop all nodes in parallel
  const stopPromises = [
    ...serviceNodes.nodes.map((node) =>
      pRetry(
        async () => {
          try {
            await node.stop();
          } catch (error) {
            log.error("Service Node failed to stop:", error);
            throw error;
          }
        },
        { retries: 3 }
      )
    ),
    ...wNodes.map((waku) =>
      pRetry(
        async () => {
          if (waku) {
            try {
              await waku.stop();
            } catch (error) {
              log.error("Waku failed to stop:", error);
              throw error;
            }
          }
        },
        { retries: 3 }
      )
    )
  ];

  await Promise.all(stopPromises);
}

// Batch test helper
export function batchTests<T>(
  items: T[],
  batchSize: number,
  testFn: (batch: T[]) => Promise<void>
): Array<() => Promise<void>> {
  const batches: Array<() => Promise<void>> = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    batches.push(() => testFn(batch));
  }

  return batches;
}

// Skip strict mode based on environment
export function shouldRunStrictMode(): boolean {
  return process.env.WAKU_TEST_STRICT_MODE !== "false";
}

// Export original functions that don't need optimization
export { validatePingError } from "./utils.js";
