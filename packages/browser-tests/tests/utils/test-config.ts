import { expect } from "@playwright/test";
import { DefaultTestRoutingInfo } from "@waku/tests";
import { AxiosResponse } from "axios";

/**
 * Response type definitions for API endpoints
 */
interface ServerHealthResponse {
  status: string;
}

interface PeerInfoResponse {
  peerId: string;
  multiaddrs: string[];
  peers: string[];
}

interface LightPushV3Result {
  successes: string[];
  failures: Array<{ error: string; peerId?: string }>;
}

interface LightPushV3Response {
  success: boolean;
  result: LightPushV3Result;
  error?: string;
}

interface MessageResponse {
  contentTopic: string;
  payload: string;
  version: number;
  timestamp?: bigint | number;
}

/**
 * Common test configuration constants following waku/tests patterns.
 */
export const TEST_CONFIG = {
  // Test timeouts (following waku/tests timeout patterns)
  DEFAULT_TEST_TIMEOUT: 120000, // 2 minutes
  CONTAINER_READY_TIMEOUT: 60000, // 1 minute
  NETWORK_FORMATION_DELAY: 5000, // 5 seconds
  SUBSCRIPTION_DELAY: 3000, // 3 seconds
  MESSAGE_PROPAGATION_DELAY: 5000, // 5 seconds
  WAKU_INIT_DELAY: 8000, // 8 seconds

  // Network configuration
  DEFAULT_CLUSTER_ID: DefaultTestRoutingInfo.clusterId.toString(),
  DEFAULT_CONTENT_TOPIC: "/test/1/browser-tests/proto",
  
  // Test messages
  DEFAULT_TEST_MESSAGE: "Hello from browser tests",
} as const;

/**
 * Environment variable builders for different test scenarios.
 */
export const ENV_BUILDERS = {
  /**
   * Environment for production ENR bootstrap (integration test pattern).
   */
  withProductionEnr: () => ({
    WAKU_ENR_BOOTSTRAP: "enr:-QEnuEBEAyErHEfhiQxAVQoWowGTCuEF9fKZtXSd7H_PymHFhGJA3rGAYDVSHKCyJDGRLBGsloNbS8AZF33IVuefjOO6BIJpZIJ2NIJpcIQS39tkim11bHRpYWRkcnO4lgAvNihub2RlLTAxLmRvLWFtczMud2FrdXYyLnRlc3Quc3RhdHVzaW0ubmV0BgG73gMAODcxbm9kZS0wMS5hYy1jbi1ob25na29uZy1jLndha3V2Mi50ZXN0LnN0YXR1c2ltLm5ldAYBu94DACm9A62t7AQL4Ef5ZYZosRpQTzFVAB8jGjf1TER2wH-0zBOe1-MDBNLeA4lzZWNwMjU2azGhAzfsxbxyCkgCqq8WwYsVWH7YkpMLnU2Bw5xJSimxKav-g3VkcIIjKA",
    WAKU_CLUSTER_ID: "1",
  }),

  /**
   * Environment for local nwaku node connection (e2e test pattern).
   */
  withLocalLightPush: (lightpushMultiaddr: string) => ({
    WAKU_LIGHTPUSH_NODE: lightpushMultiaddr,
    WAKU_CLUSTER_ID: TEST_CONFIG.DEFAULT_CLUSTER_ID,
  }),
};

/**
 * Test assertion helpers following waku/tests verification patterns.
 */
export const ASSERTIONS = {
  /**
   * Verifies server health response structure.
   */
  serverHealth: (response: AxiosResponse<ServerHealthResponse>) => {
    expect(response.status).toBe(200);
    expect(response.data.status).toBe("Waku simulation server is running");
  },

  /**
   * Verifies peer info response structure.
   */
  peerInfo: (response: AxiosResponse<PeerInfoResponse>) => {
    expect(response.status).toBe(200);
    expect(response.data.peerId).toBeDefined();
    expect(typeof response.data.peerId).toBe("string");
  },

  /**
   * Verifies lightpush response structure (v3 format).
   */
  lightPushV3Success: (response: AxiosResponse<LightPushV3Response>) => {
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('success', true);
    expect(response.data).toHaveProperty('result');
    expect(response.data.result).toHaveProperty('successes');
    expect(Array.isArray(response.data.result.successes)).toBe(true);
    expect(response.data.result.successes.length).toBeGreaterThan(0);
  },

  /**
   * Verifies message content and structure.
   */
  messageContent: (message: MessageResponse, expectedContent: string, expectedTopic: string) => {
    expect(message).toHaveProperty('contentTopic', expectedTopic);
    expect(message).toHaveProperty('payload');
    expect(typeof message.payload).toBe('string');

    const receivedPayload = Buffer.from(message.payload, 'base64').toString();
    expect(receivedPayload).toBe(expectedContent);

    // Optional fields
    expect(message).toHaveProperty('version');
    if (message.timestamp) {
      expect(['bigint', 'number']).toContain(typeof message.timestamp);
    }
  },
};