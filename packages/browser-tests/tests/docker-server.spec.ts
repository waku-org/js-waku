import { test, expect } from "@playwright/test";
import axios from "axios";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import {
  createLightNode,
  waitForRemotePeer,
  LightNode,
  Protocols,
} from "@waku/sdk";

test.describe.configure({ mode: "serial" });

let container: StartedTestContainer;
let baseUrl = "http://127.0.0.1:8080";
let wakuNode: LightNode;

test.beforeAll(async () => {
  const testEnr =
    "enr:-QEnuEBEAyErHEfhiQxAVQoWowGTCuEF9fKZtXSd7H_PymHFhGJA3rGAYDVSHKCyJDGRLBGsloNbS8AZF33IVuefjOO6BIJpZIJ2NIJpcIQS39tkim11bHRpYWRkcnO4lgAvNihub2RlLTAxLmRvLWFtczMud2FrdXYyLnRlc3Quc3RhdHVzaW0ubmV0BgG73gMAODcxbm9kZS0wMS5hYy1jbi1ob25na29uZy1jLndha3V2Mi50ZXN0LnN0YXR1c2ltLm5ldAYBu94DACm9A62t7AQL4Ef5ZYZosRpQTzFVAB8jGjf1TER2wH-0zBOe1-MDBNLeA4lzZWNwMjU2azGhAzfsxbxyCkgCqq8WwYsVWH7YkpMLnU2Bw5xJSimxKav-g3VkcIIjKA";

  const generic = new GenericContainer("waku-browser-tests:local")
    .withExposedPorts(8080)
    .withEnvironment({
      WAKU_ENR_BOOTSTRAP: testEnr,
      WAKU_CLUSTER_ID: "1",
    });

  container = await generic.start();

  await new Promise((r) => setTimeout(r, 5000));
  const logs = await container.logs({ tail: 100 });
  logs.on("data", (b) => process.stdout.write("[container] " + b.toString()));
  logs.on("error", (err) => console.error("[container log error]", err));

  const mappedPort = container.getMappedPort(8080);
  baseUrl = `http://127.0.0.1:${mappedPort}`;

  let serverReady = false;
  for (let i = 0; i < 60; i++) {
    // Increased attempts from 40 to 60
    try {
      const res = await axios.get(`${baseUrl}/`, { timeout: 2000 }); // Increased timeout
      if (res.status === 200) {
        console.log(`Server is ready after ${i + 1} attempts`);
        serverReady = true;
        break;
      }
    } catch (error: any) {
      if (i % 10 === 0) {
        console.log(`Attempt ${i + 1}/60 failed:`, error.code || error.message);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!serverReady) {
    try {
      const finalLogs = await container.logs({ tail: 50 });
      console.log("=== Final Container Logs ===");
      finalLogs.on("data", (b) => console.log(b.toString()));
      await new Promise((r) => setTimeout(r, 1000));
    } catch (logError) {
      console.error("Failed to get container logs:", logError);
    }
  }

  expect(serverReady).toBe(true);

  await new Promise((r) => setTimeout(r, 500));
});

test.afterAll(async () => {
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
      await container.stop({ timeout: 10000 });
      console.log("Container stopped successfully");
    } catch (error) {
      console.warn(
        "Container stop had issues (expected):",
        (error as any).message,
      );
    }
  }
});

test("cross-network message delivery: SDK light node receives server lightpush", async () => {
  test.setTimeout(120000); // 2 minute timeout

  const contentTopic = "/test/1/cross-network/proto";
  const testMessage = "Hello from SDK to Docker server test";

  wakuNode = await createLightNode({
    defaultBootstrap: true,
    discovery: {
      dns: true,
      peerExchange: true,
      peerCache: true,
    },
    networkConfig: {
      clusterId: 1,
      numShardsInCluster: 8,
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

  try {
    if (
      !(await wakuNode.filter.subscribe([decoder], (message) => {
        messages.push(message);
      }))
    ) {
      throw new Error("Failed to subscribe to Filter");
    }
  } catch (error) {
    console.error("❌ Failed to subscribe to Filter:", error);
    throw error;
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
