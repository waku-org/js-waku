/**
 * Light Push test utilities using the new centralized system
 */

import { createTestUtilities } from "../../src/test-utils/utilities-factory.js";

// Export all the common utilities for light push tests
export const {
  config,
  networkConfig: TestNetworkConfig,
  routingInfo: TestRoutingInfo,
  encoder: TestEncoder,
  decoder: TestDecoder,
  messagePayload,
  logger: log,
  expectOptions
} = createTestUtilities("lightpush");

// Legacy exports for backwards compatibility
export const TestContentTopic = config.contentTopic;
export const TestClusterId = config.clusterId;
export const TestNumShardsInCluster = config.numShardsInCluster;
export const messageText = config.messageText;
