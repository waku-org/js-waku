/**
 * Filter test utilities - simplified using centralized configuration
 * This demonstrates the before/after comparison by replacing the original utils
 */

import { createDecoder, createEncoder } from "@waku/core";
import {
  contentTopicToShardIndex,
  createRoutingInfo,
  Logger
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";

import { getTestConfig } from "../../src/test-configs/index.js";

// Get configuration from centralized system
const config = getTestConfig("filter");

// Export the same interface as the original for backwards compatibility
export const log = new Logger(config.loggerName);
export const TestContentTopic = config.contentTopic;
export const TestClusterId = config.clusterId;
export const TestNumShardsInCluster = config.numShardsInCluster || 8;
export const TestShardIndex = contentTopicToShardIndex(
  TestContentTopic,
  TestNumShardsInCluster
);
export const TestNetworkConfig = {
  clusterId: TestClusterId,
  numShardsInCluster: TestNumShardsInCluster
};
export const TestRoutingInfo = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic
});
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  routingInfo: TestRoutingInfo
});
export const TestDecoder = createDecoder(TestContentTopic, TestRoutingInfo);
export const messageText = config.messageText;
export const messagePayload = { payload: utf8ToBytes(messageText) };

/**
 * NOTE: This simplified version reduces the file from hard-coded constants
 * to a configuration-driven approach where all values come from a single
 * centralized source. This eliminates duplication and makes it easier to
 * maintain consistent test configurations across all protocols.
 */
