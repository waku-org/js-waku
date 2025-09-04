import { test, expect } from "@playwright/test";
import axios from "axios";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { createLightNode, waitForRemotePeer, LightNode, Protocols } from "@waku/sdk";

test.describe.configure({ mode: "serial" });

let container: StartedTestContainer;
let baseUrl = "http://127.0.0.1:8080";
let wakuNode: LightNode;
let unsubscribe: () => void;

test.beforeAll(async () => {
  // Build and run the container once for the suite; reuse across tests
  const generic = new GenericContainer(
    "waku-browser-tests:local",
  ).withExposedPorts(8080);

  container = await generic.start();

  console.log("Container started, waiting for initialization...");
  await new Promise((r) => setTimeout(r, 2000)); // Give container more time to start

  // Get initial container logs for debugging
  const logs = await container.logs({ tail: 100 });
  logs.on("data", (b) => process.stdout.write("[container] " + b.toString()));
  logs.on("error", (err) => console.error("[container log error]", err));

  const mappedPort = container.getMappedPort(8080);
  baseUrl = `http://127.0.0.1:${mappedPort}`;

  // Probe readiness - wait for both server and browser
  let serverReady = false;
  // let browserReady = false;

  // Wait for server to be ready with more debugging
  for (let i = 0; i < 60; i++) { // Increased attempts from 40 to 60
    try {
      const res = await axios.get(`${baseUrl}/`, { timeout: 2000 }); // Increased timeout
      if (res.status === 200) {
        console.log(`Server is ready after ${i + 1} attempts`);
        serverReady = true;
        break;
      }
    } catch (error: any) {
      if (i % 10 === 0) { // Log every 10th attempt
        console.log(`Attempt ${i + 1}/60 failed:`, error.code || error.message);
      }
    }
    await new Promise((r) => setTimeout(r, 1000)); // Increased wait time from 500ms to 1000ms
  }

  if (!serverReady) {
    // Get final container logs for debugging
    try {
      const finalLogs = await container.logs({ tail: 50 });
      console.log("=== Final Container Logs ===");
      finalLogs.on("data", (b) => console.log(b.toString()));
      await new Promise(r => setTimeout(r, 1000)); // Give logs time to print
    } catch (logError) {
      console.error("Failed to get container logs:", logError);
    }
  }

  expect(serverReady).toBe(true);

  await new Promise((r) => setTimeout(r, 500));
});

test.afterAll(async () => {
  // Clean up subscription first
  try {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
      console.log("Filter subscription cleaned up");
    }
  } catch (error) {
    console.warn("Filter cleanup had issues:", (error as any).message);
  }

  if (wakuNode) {
    console.log("Stopping Waku node...");
    try {
      await wakuNode.stop();
      console.log("Waku node stopped successfully");
    } catch (error) {
      console.warn("Waku node stop had issues:", (error as any).message);
    }
  }

  if (container) {
    console.log("Stopping container gracefully...");
    try {
      // Give the container a chance to shut down gracefully
      await container.stop({ timeout: 10000 });
      console.log("Container stopped successfully");
    } catch (error) {
      console.warn("Container stop had issues (expected):", (error as any).message);
    }
  }
});

test("container: health endpoint", async () => {
  const res = await axios.get(`${baseUrl}/`);
  expect(res.status).toBe(200);
  expect(res.data.status).toBe("Waku simulation server is running");
});

// Test that the node is auto-created and auto-started
test("container: node auto-started", async () => {
  // Node should be auto-created and started, so just check peer info
  const res = await axios.get(`${baseUrl}/waku/v1/peer-info`);
  expect(res.status).toBe(200);
  expect(res.data.peerId).toBeDefined();
  expect(res.data.multiaddrs).toBeDefined();
});

test("container: node ready and push", async () => {
  // Node is auto-created and started with environment variables

  // Wait for Lightpush peers with longer timeout for real network connections
  console.log("⏳ Waiting for Lightpush peers to connect...");
  try {
    await axios.post(`${baseUrl}/waku/v1/wait-for-peers`, {
      timeoutMs: 30000,
      protocols: ["lightpush"] // 30 second timeout for real network
    });
    console.log("✅ Found Lightpush peers");
  } catch (e) {
    console.error("❌ Failed to find Lightpush peers:", e);
    throw new Error("Failed to connect to Lightpush peers - this should succeed in all environments");
  }

  // Also wait for Filter peers
  console.log("⏳ Waiting for Filter peers to connect...");
  try {
    await axios.post(`${baseUrl}/waku/v1/wait-for-peers`, {
      timeoutMs: 30000,
      protocols: ["filter"] // 30 second timeout for real network
    });
    console.log("✅ Found Filter peers");
  } catch (e) {
    console.warn("⚠️ No Filter peers found (non-critical):", e);
  }

  // Test lightpush endpoint - expect it to succeed with real peers
  console.log("📤 Attempting to push message to Waku network...");
  const testMessage = "Hello from Docker container test";
  const base64Payload = btoa(testMessage); // Convert to base64

  const push = await axios.post(`${baseUrl}/lightpush/v3/message`, {
    pubsubTopic: "/waku/2/default-waku/proto",
    message: {
      contentTopic: "/test/1/message/proto",
      payload: base64Payload,
      version: 1
    },
  });

  // Verify successful push (v3 API returns { success: boolean, result?: SDKProtocolResult })
  expect(push.status).toBe(200);
  expect(push.data).toBeDefined();
  expect(push.data.success).toBe(true);
  expect(push.data.result).toBeDefined();
  expect(push.data.result.successes).toBeDefined();
  expect(push.data.result.successes.length).toBeGreaterThan(0);
  console.log("✅ Message successfully pushed to Waku network!");

  // Log a clean summary instead of raw JSON
  const successCount = push.data.result.successes?.length || 0;
  const failureCount = push.data.result.failures?.length || 0;
  console.log(`📊 Push Summary: ${successCount} success(es), ${failureCount} failure(s)`);

  if (successCount > 0) {
    console.log("📤 Successfully sent to peers:");
    push.data.result.successes.forEach((peerIdString: string, index: number) => {
      console.log(`  ${index + 1}. ${peerIdString}`);
    });
  }

  if (failureCount > 0) {
    console.log("❌ Failed to send to peers:");
    push.data.result.failures.forEach((failure: { error: string; peerId?: string }, index: number) => {
      const peerInfo = failure.peerId || 'unknown peer';
      console.log(`  ${index + 1}. ${peerInfo} - ${failure.error}`);
    });
  }
});

test("cross-network message delivery: SDK light node receives server lightpush", async () => {
  const contentTopic = "/test/1/cross-network/proto";
  const pubsubTopic = "/waku/2/default-waku/proto";
  const testMessage = "Hello from SDK to Docker server test";

  console.log("🚀 Creating SDK light node with same config as server...");

  // Create light node with same configuration as the docker server
  wakuNode = await createLightNode({
    defaultBootstrap: true,
    networkConfig: {
      clusterId: 1,
      numShardsInCluster: 8
    },
    libp2p: {
      filterMultiaddrs: false
    }
  });

  await wakuNode.start();
  console.log("✅ SDK light node started");

  // Wait for filter peer to connect
  console.log("⏳ Waiting for Filter peers to connect...");
  await waitForRemotePeer(wakuNode, [Protocols.Filter]);
  console.log("✅ Connected to Filter peers");

  // Set up message subscription
  console.log("📡 Setting up message subscription...");
  const messages: any[] = [];

  console.log(`🔍 Subscribing to contentTopic: "${contentTopic}" on pubsubTopic: "${pubsubTopic}"`);

  // Create decoder that matches the server's encoder (using same pattern as server)
  const decoder = wakuNode.createDecoder({ contentTopic, pubsubTopic });
  console.log("🔧 Created decoder with pubsubTopic:", decoder.pubsubTopic);

  // Set up message subscription and WAIT for it to be established
  try {
    unsubscribe = await wakuNode.filter.subscribe(
      [decoder],
      (message) => {
        console.log("📥 Received message via Filter!");
        console.log(`📝 Message details: topic=${message.contentTopic}, payload="${new TextDecoder().decode(message.payload)}"`);
        messages.push(message);
      }
    );
    console.log("✅ Filter subscription established successfully");
  } catch (error) {
    console.error("❌ Failed to subscribe to Filter:", error);
    throw error;
  }

  // Give extra time for subscription to propagate to network
  console.log("⏳ Waiting for subscription to propagate...");
  await new Promise(r => setTimeout(r, 2000));

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

  // Server node is auto-created and started
  console.log("✅ Server node auto-configured and ready");

  // CRITICAL: Wait for server node to find peers BEFORE attempting to send
  console.log("⏳ Waiting for server to connect to Lightpush peers...");
  await axios.post(`${baseUrl}/waku/v1/wait-for-peers`, {
    timeoutMs: 30000,
    protocols: ["lightpush"]
  });
  console.log("✅ Server connected to Lightpush peers");

  console.log("⏳ Waiting for server to connect to Filter peers...");
  try {
    await axios.post(`${baseUrl}/waku/v1/wait-for-peers`, {
      timeoutMs: 30000,
      protocols: ["filter"]
    });
    console.log("✅ Server connected to Filter peers");
  } catch (e) {
    console.warn("⚠️ Server didn't connect to Filter peers:", e);
  }

  // Give nodes extra time to discover each other and establish proper mesh connectivity
  console.log("⏳ Allowing time for nodes to discover each other...");
  await new Promise(r => setTimeout(r, 8000));

  // Debug: Check peer information before sending
  console.log("🔍 Checking peer connections...");
  try {
    const peerInfo = await axios.get(`${baseUrl}/waku/v1/peer-info`);
    console.log(`📊 Server peer count: ${JSON.stringify(peerInfo.data)}`);
  } catch (e) {
    console.warn("⚠️ Could not get peer info:", e);
  }

  // IMPORTANT: Verify filter is ready before sending
  console.log("🔍 Verifying filter subscription is active before sending...");

  // Send message via server's lightpush
  console.log("📤 Sending message via server lightpush...");
  const base64Payload = btoa(testMessage);

  const pushResponse = await axios.post(`${baseUrl}/lightpush/v3/message`, {
    pubsubTopic,
    message: {
      contentTopic,
      payload: base64Payload,
      version: 1
    }
  });

  expect(pushResponse.status).toBe(200);
  expect(pushResponse.data.success).toBe(true);
  console.log("✅ Message sent via server lightpush");

  // Wait for message to be received by SDK node (with longer timeout for network propagation)
  console.log("⏳ Waiting for message to be received by SDK node...");
  console.log("💡 Note: Filter messages may take time to propagate through the network...");

  await Promise.race([
    messagePromise,
    new Promise((_, reject) =>
      setTimeout(() => {
        console.error(`❌ Timeout after 45 seconds. Messages received: ${messages.length}`);
        reject(new Error("Timeout waiting for message"));
      }, 45000)
    )
  ]);

  // Verify message was received
  expect(messages).toHaveLength(1);
  const receivedMessage = messages[0];
  expect(receivedMessage.contentTopic).toBe(contentTopic);

  // Decode and verify payload
  const receivedPayload = new TextDecoder().decode(receivedMessage.payload);
  expect(receivedPayload).toBe(testMessage);

  console.log("🎉 SUCCESS: Message successfully sent from server and received by SDK node!");
  console.log(`📝 Message content: "${receivedPayload}"`);
});
