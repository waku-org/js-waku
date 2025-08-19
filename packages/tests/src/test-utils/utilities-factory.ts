/**
 * Unified test utilities factory to create protocol-specific test objects
 * and reduce code duplication across test suites.
 */

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { getTestConfig, ProtocolTestConfig } from "../test-configs/index.js";

export interface TestUtilities {
  config: ProtocolTestConfig;
  networkConfig: any; // AutoSharding type from @waku/interfaces
  routingInfo: any; // RoutingInfo type from @waku/utils
  encoder: any; // Encoder type from @waku/core
  decoder: any; // Decoder type from @waku/core
  messagePayload: { payload: Uint8Array };
  logger: any; // Logger type from @waku/utils
  expectOptions: {
    expectedContentTopic: string;
    expectedPubsubTopic: string;
    expectedMessageText: string;
  };
}

/**
 * Create a complete set of test utilities for a given protocol
 * Note: This is a placeholder implementation that will work when dependencies are available
 */
export function createTestUtilities(protocol: string): TestUtilities {
  const config = getTestConfig(protocol);

  // Placeholder implementation for when imports are available
  const networkConfig = {
    clusterId: config.clusterId,
    numShardsInCluster: config.numShardsInCluster || 8
  };

  // These will be replaced with proper implementations when imports work
  const routingInfo = {
    pubsubTopic: `/waku/2/rs/${config.clusterId}/1`
  };

  const encoder = {};
  const decoder = {};

  const messagePayload = {
    payload: new TextEncoder().encode(config.messageText)
  };

  const logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };

  const expectOptions = {
    expectedContentTopic: config.contentTopic,
    expectedPubsubTopic: routingInfo.pubsubTopic,
    expectedMessageText: config.messageText
  };

  return {
    config,
    networkConfig,
    routingInfo,
    encoder,
    decoder,
    messagePayload,
    logger,
    expectOptions
  };
}

/**
 * Create test utilities with custom configuration overrides
 */
export function createCustomTestUtilities(
  protocol: string,
  configOverrides: Partial<ProtocolTestConfig>
): TestUtilities {
  const baseConfig = getTestConfig(protocol);
  const customConfig = { ...baseConfig, ...configOverrides };

  // Use the same placeholder approach as above
  const networkConfig = {
    clusterId: customConfig.clusterId,
    numShardsInCluster: customConfig.numShardsInCluster || 8
  };

  const routingInfo = {
    pubsubTopic: `/waku/2/rs/${customConfig.clusterId}/1`
  };

  const encoder = {};
  const decoder = {};

  const messagePayload = {
    payload: new TextEncoder().encode(customConfig.messageText)
  };

  const logger = {
    info: console.log,
    warn: console.warn,
    error: console.error
  };

  const expectOptions = {
    expectedContentTopic: customConfig.contentTopic,
    expectedPubsubTopic: routingInfo.pubsubTopic,
    expectedMessageText: customConfig.messageText
  };

  return {
    config: customConfig,
    networkConfig,
    routingInfo,
    encoder,
    decoder,
    messagePayload,
    logger,
    expectOptions
  };
}
