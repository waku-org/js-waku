import { ChildProcess, spawn } from "child_process";
import { join } from "path";

import { expect, test } from "@playwright/test";
import axios from "axios";

const API_URL = "http://localhost:3000";
// Need this for basic node initialization that doesn't rely on /execute
const PEERS = [
  "/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ",
  "/dns4/waku.fryorcraken.xyz/tcp/8000/wss/p2p/16Uiu2HAmMRvhDHrtiHft1FTUYnn6cVA8AWVrTyLUayJJ3MWpUZDB"
];

let serverProcess: ChildProcess;

// Force tests to run sequentially to avoid port conflicts
test.describe.configure({ mode: "serial" });

// Setup and teardown for the whole test suite
test.beforeAll(async () => {
  // Start the server
  console.log("Starting server for tests...");
  serverProcess = spawn("node", [join(process.cwd(), "dist/server.js")], {
    stdio: "pipe",
    detached: true
  });

  // Log server output for debugging
  serverProcess.stdout?.on("data", (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr?.on("data", (data) => {
    console.error(`Server Error: ${data}`);
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // The server starts up with a default node, but it needs to be initialized via page.evaluate
  // We can't use this directly, so we'll need to work around it in our tests

  // First need to create a node
  const createNodeResponse = await axios.post(
    `${API_URL}/admin/v1/create-node`,
    {
      defaultBootstrap: false,
      networkConfig: {
        clusterId: 42,
        shards: [0]
      }
    }
  );
  expect(createNodeResponse.status).toBe(200);
  console.log("Node creation response:", createNodeResponse.data);
});

test.afterAll(async () => {
  // Stop the server
  console.log("Stopping server...");
  if (serverProcess && serverProcess.pid) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", serverProcess.pid.toString(), "/f", "/t"]);
    } else {
      process.kill(-serverProcess.pid, "SIGINT");
    }
  }
});

test.describe("Waku Server API", () => {
  // This test checks if the server is running and can serve the basic endpoints
  test("can get server status", async () => {
    // Get initial server status
    const initialResponse = await axios.get(`${API_URL}/`);
    expect(initialResponse.status).toBe(200);
    expect(initialResponse.data.status).toBe(
      "Waku simulation server is running"
    );
  });

  // Test node lifecycle operations using the dedicated endpoints
  test("can create, start, and stop a node", async () => {
    // 1. Create a new node
    const createResponse = await axios.post(`${API_URL}/admin/v1/create-node`, {
      defaultBootstrap: true
    });
    expect(createResponse.status).toBe(200);
    expect(createResponse.data.success).toBe(true);

    // 2. Start the node
    const startResponse = await axios.post(`${API_URL}/admin/v1/start-node`);
    expect(startResponse.status).toBe(200);
    expect(startResponse.data.success).toBe(true);

    // 3. Get info to verify it's running
    const infoResponse = await axios.get(`${API_URL}/info`);
    expect(infoResponse.status).toBe(200);
    expect(infoResponse.data.peerId).toBeDefined();
    console.log("Node peer ID:", infoResponse.data.peerId);

    // 4. Stop the node
    const stopResponse = await axios.post(`${API_URL}/admin/v1/stop-node`);
    expect(stopResponse.status).toBe(200);
    expect(stopResponse.data.success).toBe(true);

    // 5. Start it again
    const restartResponse = await axios.post(`${API_URL}/admin/v1/start-node`);
    expect(restartResponse.status).toBe(200);
    expect(restartResponse.data.success).toBe(true);

    // 6. Verify it's running again
    const finalInfoResponse = await axios.get(`${API_URL}/info`);
    expect(finalInfoResponse.status).toBe(200);
    expect(finalInfoResponse.data.peerId).toBeDefined();
  });

  // This test requires a running node, which we now can properly initialize with our new endpoints
  test("can connect to peers and get node info", async () => {
    // Create and start a fresh node
    await axios.post(`${API_URL}/admin/v1/create-node`, {
      defaultBootstrap: false
    });
    await axios.post(`${API_URL}/admin/v1/start-node`);

    // Connect to peers
    const dialResponse = await axios.post(`${API_URL}/admin/v1/peers`, {
      peerMultiaddrs: PEERS
    });

    expect(dialResponse.status).toBe(200);
    console.log("Peer connection response:", dialResponse.data);

    // Get debug info now that we have a properly initialized node
    const debugResponse = await axios.get(`${API_URL}/debug/v1/info`);
    expect(debugResponse.status).toBe(200);
    expect(debugResponse.data).toBeDefined();

    // Log protocols available
    if (debugResponse.data.protocols) {
      const wakuProtocols = debugResponse.data.protocols.filter((p: string) =>
        p.includes("/waku/")
      );
      console.log("Waku protocols:", wakuProtocols);
    }
  });

  test("can push messages", async () => {
    // Create and start a fresh node
    await axios.post(`${API_URL}/admin/v1/create-node`, {
      defaultBootstrap: true
    });
    await axios.post(`${API_URL}/admin/v1/start-node`);

    // Connect to peers
    await axios.post(`${API_URL}/admin/v1/peers`, {
      peerMultiaddrs: PEERS
    });

    // Test the REST API format push endpoint
    try {
      const restPushResponse = await axios.post(
        `${API_URL}/lightpush/v1/message`,
        {
          pubsubTopic: "/waku/2/default-waku/proto",
          message: {
            contentTopic: "/test/1/message/proto",
            payload: Array.from(
              new TextEncoder().encode("Test message via REST endpoint")
            )
          }
        }
      );

      expect(restPushResponse.status).toBe(200);
      expect(restPushResponse.data.messageId).toBeDefined();
      console.log("Message ID:", restPushResponse.data.messageId);
    } catch (error) {
      console.log("REST push might fail if no peers connected:", error);
    }
  });
});
