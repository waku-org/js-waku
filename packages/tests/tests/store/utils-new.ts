/**
 * Store test utilities using the new centralized system
 */

import { createTestUtilities } from "../../src/test-utils/utilities-factory.js";

// Export all the common utilities for store tests
export const {
  config,
  networkConfig: TestNetworkConfig,
  routingInfo: TestRoutingInfo,
  encoder: TestEncoder,
  decoder: TestDecoder,
  messagePayload,
  logger: log,
  expectOptions
} = createTestUtilities("store");

// Legacy exports for backwards compatibility
export const TestContentTopic = config.contentTopic;
export const TestClusterId = config.clusterId;
export const TestNumShardsInCluster = config.numShardsInCluster;
export const messageText = config.messageText;
export const TestPubsubTopic = TestRoutingInfo.pubsubTopic;

// Store-specific exports that were in the original utils.ts
export const totalMsgs = 20;

// Create a single utilities instance for the additional content topic
const storeUtilities2 = createTestUtilities("store");

// Additional content topic for multi-topic tests
export const TestContentTopic2 = "/test/12/waku-store/utf8";
export const TestRoutingInfo2 = storeUtilities2.routingInfo;
export const TestDecoder2 = storeUtilities2.decoder;

// Note: The original utils.ts had more complex helper functions like sendMessages,
// processQueriedMessages, etc. These could be moved to common-patterns.ts or kept
// as store-specific utilities if they're not reusable across protocols.
