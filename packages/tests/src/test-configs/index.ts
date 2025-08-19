/**
 * Centralized test configuration system to reduce code duplication
 * across different protocol test suites.
 */

export interface ProtocolTestConfig {
  clusterId: number;
  contentTopic: string;
  messageText: string;
  loggerName: string;
  numShardsInCluster?: number;
}

export const DEFAULT_NUM_SHARDS_IN_CLUSTER = 8;

/**
 * Protocol-specific test configurations
 */
export const TEST_CONFIGS: Record<string, ProtocolTestConfig> = {
  filter: {
    clusterId: 2,
    contentTopic: "/test/1/waku-filter/default",
    messageText: "Filtering works!",
    loggerName: "test:filter",
    numShardsInCluster: DEFAULT_NUM_SHARDS_IN_CLUSTER
  },
  lightpush: {
    clusterId: 3,
    contentTopic: "/test/1/waku-light-push/utf8",
    messageText: "Light Push works!",
    loggerName: "test:lightpush",
    numShardsInCluster: DEFAULT_NUM_SHARDS_IN_CLUSTER
  },
  store: {
    clusterId: 5,
    contentTopic: "/test/1/waku-store/utf8",
    messageText: "Store Push works!",
    loggerName: "test:store",
    numShardsInCluster: DEFAULT_NUM_SHARDS_IN_CLUSTER
  },
  relay: {
    clusterId: 4,
    contentTopic: "/test/0/waku-relay/utf8",
    messageText: "Relay works!",
    loggerName: "test:relay",
    numShardsInCluster: DEFAULT_NUM_SHARDS_IN_CLUSTER
  }
};

/**
 * Get test configuration for a specific protocol
 */
export function getTestConfig(
  protocol: keyof typeof TEST_CONFIGS
): ProtocolTestConfig {
  const config = TEST_CONFIGS[protocol];
  if (!config) {
    throw new Error(`Unknown protocol: ${protocol}`);
  }
  return { ...config };
}

/**
 * Create a custom test configuration by overriding default values
 */
export function createCustomTestConfig(
  baseProtocol: keyof typeof TEST_CONFIGS,
  overrides: Partial<ProtocolTestConfig>
): ProtocolTestConfig {
  const baseConfig = getTestConfig(baseProtocol);
  return { ...baseConfig, ...overrides };
}
