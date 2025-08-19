/**
 * Filter-specific test utilities using the new centralized system
 * This replaces the old filter/utils.ts with a much simpler implementation
 */

import { createTestUtilities } from "../../src/test-utils/utilities-factory.js";

// Export all the common utilities for filter tests
export const {
  config,
  networkConfig: TestNetworkConfig,
  routingInfo: TestRoutingInfo,
  encoder: TestEncoder,
  decoder: TestDecoder,
  messagePayload,
  logger: log,
  expectOptions
} = createTestUtilities("filter");

// Legacy exports for backwards compatibility
export const TestContentTopic = config.contentTopic;
export const TestClusterId = config.clusterId;
export const TestNumShardsInCluster = config.numShardsInCluster;
export const TestShardIndex = 1; // This was calculated before, now simplified
export const messageText = config.messageText;
