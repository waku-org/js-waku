import { test, expect } from "@playwright/test";
import axios from "axios";
import { StartedTestContainer } from "testcontainers";
import { ServiceNodesFleet } from "@waku/tests";
import { DefaultTestRoutingInfo } from "@waku/tests";
import { 
  startBrowserTestsContainer, 
  stopContainer 
} from "./utils/container-helpers.js";
import { 
  createTwoNodeNetwork, 
  getDockerAccessibleMultiaddr, 
  stopNwakuNodes 
} from "./utils/nwaku-helpers.js";
import { 
  ENV_BUILDERS, 
  TEST_CONFIG, 
  ASSERTIONS 
} from "./utils/test-config.js";

test.describe.configure({ mode: "serial" });

let container: StartedTestContainer;
let nwakuNodes: ServiceNodesFleet;
let baseUrl: string;

test.beforeAll(async () => {
  // Create nwaku network using shared utility
  nwakuNodes = await createTwoNodeNetwork();

  // Get Docker-accessible multiaddr for the lightpush node
  const lightPushPeerAddr = await getDockerAccessibleMultiaddr(nwakuNodes.nodes[0]);

  // Start browser-tests container with nwaku peer configuration
  const result = await startBrowserTestsContainer({
    environment: ENV_BUILDERS.withLocalLightPush(lightPushPeerAddr),
    networkMode: "waku", // Connect to nwaku network
  });
  
  container = result.container;
  baseUrl = result.baseUrl;
});

test.afterAll(async () => {
  // Clean shutdown using shared utilities (following waku/tests patterns)
  await Promise.all([
    stopContainer(container),
    stopNwakuNodes(nwakuNodes?.nodes || []),
  ]);
});

test("WakuHeadless can discover nwaku peer and use it for light push", async () => {
  test.setTimeout(TEST_CONFIG.DEFAULT_TEST_TIMEOUT);

  const contentTopic = TEST_CONFIG.DEFAULT_CONTENT_TOPIC;
  const testMessage = TEST_CONFIG.DEFAULT_TEST_MESSAGE;

  // Wait for WakuHeadless initialization
  console.log("Waiting for WakuHeadless initialization...");
  await new Promise((r) => setTimeout(r, TEST_CONFIG.WAKU_INIT_DELAY));

  // Verify server health using shared assertion
  console.log("Checking server health...");
  const healthResponse = await axios.get(`${baseUrl}/`, { timeout: 5000 });
  ASSERTIONS.serverHealth(healthResponse);
  console.log("✅ Server health check passed");

  // Wait for peers with timeout and error handling
  console.log("Waiting for peers...");
  try {
    await axios.post(`${baseUrl}/waku/v1/wait-for-peers`, {
      timeoutMs: 10000,
      protocols: ["lightpush"],
    }, { timeout: 15000 });
    console.log("✅ Found lightpush peers");
  } catch (error) {
    console.log("⚠️  Wait-for-peers failed or timed out:", error.message);
    // Continue with test anyway
  }

  // Verify peer info using shared assertion
  console.log("Getting peer info...");
  const peerInfoResponse = await axios.get(`${baseUrl}/waku/v1/peer-info`);
  ASSERTIONS.peerInfo(peerInfoResponse);
  console.log("✅ WakuHeadless peer ID:", peerInfoResponse.data.peerId);
  
  // Setup nwaku nodes for message reception
  console.log("Setting up nwaku nodes for message reception...");
  const routingInfo = DefaultTestRoutingInfo;
  
  const subscriptionResults = await Promise.all([
    nwakuNodes.nodes[0].ensureSubscriptions([routingInfo.pubsubTopic]),
    nwakuNodes.nodes[1].ensureSubscriptions([routingInfo.pubsubTopic])
  ]);
  
  expect(subscriptionResults[0]).toBe(true);
  expect(subscriptionResults[1]).toBe(true);
  console.log("✅ Subscription setup complete");

  // Wait for subscription establishment
  await new Promise((r) => setTimeout(r, TEST_CONFIG.SUBSCRIPTION_DELAY));

  // Send message via lightpush
  console.log("Sending message via lightpush...");
  const base64Payload = btoa(testMessage);

  const pushResponse = await axios.post(`${baseUrl}/lightpush/v3/message`, {
    pubsubTopic: routingInfo.pubsubTopic,
    message: {
      contentTopic,
      payload: base64Payload,
      version: 1,
    },
  });

  // Verify lightpush success using shared assertion
  ASSERTIONS.lightPushV3Success(pushResponse);
  console.log("✅ Message sent successfully via lightpush");

  // Wait for message propagation
  console.log("Waiting for message propagation...");
  await new Promise((r) => setTimeout(r, TEST_CONFIG.MESSAGE_PROPAGATION_DELAY));

  // Verify message reception on nwaku nodes
  console.log("Checking message reception on nwaku nodes...");
  const [node1Messages, node2Messages] = await Promise.all([
    nwakuNodes.nodes[0].messages(contentTopic),
    nwakuNodes.nodes[1].messages(contentTopic)
  ]);
  
  console.log(`Node 1 (lightpush) received ${node1Messages.length} message(s)`);
  console.log(`Node 2 (relay) received ${node2Messages.length} message(s)`);

  // Verify message propagation
  const totalMessages = node1Messages.length + node2Messages.length;
  expect(totalMessages).toBeGreaterThanOrEqual(1);
  console.log("✅ Message propagated through relay network");

  // Verify message content using shared assertion
  const receivedMessages = [...node1Messages, ...node2Messages];
  expect(receivedMessages.length).toBeGreaterThan(0);
  
  const receivedMessage = receivedMessages[0];
  ASSERTIONS.messageContent(receivedMessage, testMessage, contentTopic);
  console.log("✅ Message content verified");

  console.log("🎉 Test passed: WakuHeadless successfully discovered nwaku peer and sent message via light push");
});