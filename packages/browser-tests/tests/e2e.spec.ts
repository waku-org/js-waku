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
  nwakuNodes = await createTwoNodeNetwork();

  const lightPushPeerAddr = await getDockerAccessibleMultiaddr(nwakuNodes.nodes[0]);

  const result = await startBrowserTestsContainer({
    environment: ENV_BUILDERS.withLocalLightPush(lightPushPeerAddr),
    networkMode: "waku",
  });
  
  container = result.container;
  baseUrl = result.baseUrl;
});

test.afterAll(async () => {
  await Promise.all([
    stopContainer(container),
    stopNwakuNodes(nwakuNodes?.nodes || []),
  ]);
});

test("WakuHeadless can discover nwaku peer and use it for light push", async () => {
  test.setTimeout(TEST_CONFIG.DEFAULT_TEST_TIMEOUT);

  const contentTopic = TEST_CONFIG.DEFAULT_CONTENT_TOPIC;
  const testMessage = TEST_CONFIG.DEFAULT_TEST_MESSAGE;

  await new Promise((r) => setTimeout(r, TEST_CONFIG.WAKU_INIT_DELAY));

  const healthResponse = await axios.get(`${baseUrl}/`, { timeout: 5000 });
  ASSERTIONS.serverHealth(healthResponse);

  try {
    await axios.post(`${baseUrl}/waku/v1/wait-for-peers`, {
      timeoutMs: 10000,
      protocols: ["lightpush"],
    }, { timeout: 15000 });
  } catch {
    // Ignore errors
  }

  const peerInfoResponse = await axios.get(`${baseUrl}/waku/v1/peer-info`);
  ASSERTIONS.peerInfo(peerInfoResponse);
  
  const routingInfo = DefaultTestRoutingInfo;
  
  const subscriptionResults = await Promise.all([
    nwakuNodes.nodes[0].ensureSubscriptions([routingInfo.pubsubTopic]),
    nwakuNodes.nodes[1].ensureSubscriptions([routingInfo.pubsubTopic])
  ]);
  
  expect(subscriptionResults[0]).toBe(true);
  expect(subscriptionResults[1]).toBe(true);

  await new Promise((r) => setTimeout(r, TEST_CONFIG.SUBSCRIPTION_DELAY));

  const base64Payload = btoa(testMessage);

  const pushResponse = await axios.post(`${baseUrl}/lightpush/v3/message`, {
    pubsubTopic: routingInfo.pubsubTopic,
    message: {
      contentTopic,
      payload: base64Payload,
      version: 1,
    },
  });

  ASSERTIONS.lightPushV3Success(pushResponse);

  await new Promise((r) => setTimeout(r, TEST_CONFIG.MESSAGE_PROPAGATION_DELAY));

  const [node1Messages, node2Messages] = await Promise.all([
    nwakuNodes.nodes[0].messages(contentTopic),
    nwakuNodes.nodes[1].messages(contentTopic)
  ]);
  

  const totalMessages = node1Messages.length + node2Messages.length;
  expect(totalMessages).toBeGreaterThanOrEqual(1);

  const receivedMessages = [...node1Messages, ...node2Messages];
  expect(receivedMessages.length).toBeGreaterThan(0);
  
  const receivedMessage = receivedMessages[0];
  ASSERTIONS.messageContent(receivedMessage, testMessage, contentTopic);

});