import { test, expect } from "@playwright/test";
import axios from "axios";
import { StartedTestContainer } from "testcontainers";
import {
  createLightNode,
  waitForRemotePeer,
  LightNode,
  Protocols,
} from "@waku/sdk";
import { DEFAULT_CLUSTER_ID, DEFAULT_NUM_SHARDS } from "@waku/interfaces";
import { startBrowserTestsContainer, stopContainer } from "./utils/container-helpers.js";
import { ENV_BUILDERS, TEST_CONFIG } from "./utils/test-config.js";

test.describe.configure({ mode: "serial" });

let container: StartedTestContainer;
let baseUrl: string;
let wakuNode: LightNode;

test.beforeAll(async () => {
  const result = await startBrowserTestsContainer({
    environment: {
      ...ENV_BUILDERS.withProductionEnr(),
      DEBUG: "waku:*",
    },
  });

  container = result.container;
  baseUrl = result.baseUrl;
});

test.afterAll(async () => {
  if (wakuNode) {
    try {
      await wakuNode.stop();
    } catch {
      // Ignore errors
    }
  }

  await stopContainer(container);
});

test("cross-network message delivery: SDK light node receives server lightpush", async () => {
  test.setTimeout(TEST_CONFIG.DEFAULT_TEST_TIMEOUT);

  const contentTopic = TEST_CONFIG.DEFAULT_CONTENT_TOPIC; 
  const testMessage = TEST_CONFIG.DEFAULT_TEST_MESSAGE;

  wakuNode = await createLightNode({
    defaultBootstrap: true,
    discovery: {
      dns: true,
      peerExchange: true,
      peerCache: true,
    },
    networkConfig: {
      clusterId: DEFAULT_CLUSTER_ID,
      numShardsInCluster: DEFAULT_NUM_SHARDS,
    },
    libp2p: {
      filterMultiaddrs: false,
    },
  });

  await wakuNode.start();

  await waitForRemotePeer(
    wakuNode,
    [Protocols.Filter, Protocols.LightPush],
    30000,
  );

  const messages: any[] = [];
  const decoder = wakuNode.createDecoder({ contentTopic });

  if (
    !(await wakuNode.filter.subscribe([decoder], (message) => {
      messages.push(message);
    }))
  ) {
    throw new Error("Failed to subscribe to Filter");
  }

  await new Promise((r) => setTimeout(r, 2000));

  const messagePromise = new Promise<void>((resolve) => {
    const originalLength = messages.length;
    const checkForMessage = () => {
      if (messages.length > originalLength) {
        resolve();
      } else {
        setTimeout(checkForMessage, 100);
      }
    };
    checkForMessage();
  });

  await axios.post(`${baseUrl}/waku/v1/wait-for-peers`, {
    timeoutMs: 30000, // Increased timeout
    protocols: ["lightpush", "filter"],
  });

  await new Promise((r) => setTimeout(r, 10000));

  const base64Payload = btoa(testMessage);

  const pushResponse = await axios.post(`${baseUrl}/lightpush/v3/message`, {
    pubsubTopic: decoder.pubsubTopic,
    message: {
      contentTopic,
      payload: base64Payload,
      version: 1,
    },
  });

  expect(pushResponse.status).toBe(200);
  expect(pushResponse.data.success).toBe(true);

  await Promise.race([
    messagePromise,
    new Promise((_, reject) =>
      setTimeout(() => {
        reject(new Error("Timeout waiting for message"));
      }, 45000),
    ),
  ]);

  expect(messages).toHaveLength(1);
  const receivedMessage = messages[0];
  expect(receivedMessage.contentTopic).toBe(contentTopic);

  const receivedPayload = new TextDecoder().decode(receivedMessage.payload);
  expect(receivedPayload).toBe(testMessage);
});
