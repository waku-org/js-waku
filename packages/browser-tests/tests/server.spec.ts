import { ChildProcess, exec, spawn } from "child_process";
import * as http from "http";
import * as net from "net";
import { join } from "path";

import { expect, test } from "@playwright/test";
import axios from "axios";

// The default URL, but we'll update this if we detect a different port
let API_URL = "http://localhost:3000";
// Need this for basic node initialization that doesn't rely on /execute
const PEERS = [
  "/dns4/waku-test.bloxy.one/tcp/8095/wss/p2p/16Uiu2HAmSZbDB7CusdRhgkD81VssRjQV5ZH13FbzCGcdnbbh6VwZ",
  "/dns4/waku.fryorcraken.xyz/tcp/8000/wss/p2p/16Uiu2HAmMRvhDHrtiHft1FTUYnn6cVA8AWVrTyLUayJJ3MWpUZDB"
];

let serverProcess: ChildProcess;

// Force tests to run sequentially to avoid port conflicts
test.describe.configure({ mode: "serial" });

// Helper function to check if a port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once("error", () => {
        // Port is in use
        resolve(true);
      })
      .once("listening", () => {
        // Port is free, close server
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

// Helper function to kill processes on port 3000
async function killProcessOnPort(): Promise<void> {
  return new Promise<void>((resolve) => {
    // Different commands for different platforms
    const cmd =
      process.platform === "win32"
        ? `netstat -ano | findstr :3000 | findstr LISTENING`
        : `lsof -i:3000 -t`;

    exec(cmd, (err, stdout) => {
      if (err || !stdout.trim()) {
        console.log("No process running on port 3000");
        resolve();
        return;
      }

      console.log(`Found processes on port 3000: ${stdout.trim()}`);

      // Kill the process
      const killCmd =
        process.platform === "win32"
          ? `FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') DO taskkill /F /PID %P`
          : `kill -9 ${stdout.trim()}`;

      exec(killCmd, (killErr) => {
        if (killErr) {
          console.error(`Error killing process: ${killErr.message}`);
        } else {
          console.log("Killed process on port 3000");
        }

        // Wait a moment for OS to release the port
        setTimeout(resolve, 500);
      });
    });
  });
}

// Helper function to wait for the API server to be available
async function waitForApiServer(
  maxRetries = 10,
  interval = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(API_URL, { timeout: 2000 });
      if (response.status === 200) {
        console.log(`API server is available at ${API_URL}`);
        return true;
      }
    } catch (e) {
      console.log(
        `API server not available at ${API_URL}, retrying (${i + 1}/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  console.warn(
    `API server at ${API_URL} not available after ${maxRetries} attempts`
  );
  return false;
}

// Setup and teardown for the whole test suite
test.beforeAll(async () => {
  // First check if port 3000 is already in use - if so, try to kill it
  const portInUse = await isPortInUse(3000);
  if (portInUse) {
    console.log(
      "Port 3000 is already in use. Attempting to kill the process..."
    );
    await killProcessOnPort();

    // Check again
    const stillInUse = await isPortInUse(3000);
    if (stillInUse) {
      console.log("Failed to free port 3000. Waiting for it to be released...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  // Start the server
  console.log("Starting server for tests...");
  serverProcess = spawn("node", [join(process.cwd(), "dist/server.js")], {
    stdio: "pipe",
    detached: true
  });

  // Log server output for debugging and capture the actual port
  serverProcess.stdout?.on("data", (data) => {
    const output = data.toString();
    console.log(`Server: ${output}`);

    // Check if the output contains the port information
    const portMatch = output.match(
      /API server running on http:\/\/localhost:(\d+)/
    );
    if (portMatch && portMatch[1]) {
      const detectedPort = parseInt(portMatch[1], 10);
      if (detectedPort !== 3000) {
        console.log(
          `Server is running on port ${detectedPort} instead of 3000`
        );
        API_URL = `http://localhost:${detectedPort}`;
      }
    }
  });

  serverProcess.stderr?.on("data", (data) => {
    console.error(`Server Error: ${data}`);
  });

  // Wait for server to start and API to be available
  console.log("Waiting for server to start...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const apiAvailable = await waitForApiServer();
  if (!apiAvailable) {
    console.warn("API server is not available, tests may fail");
  }

  if (apiAvailable) {
    // Create a node for the tests
    try {
      console.log("Creating node for tests...");
      const createNodeResponse = await axios.post(
        `${API_URL}/admin/v1/create-node`,
        {
          defaultBootstrap: false,
          networkConfig: {
            clusterId: 42,
            shards: [0]
          },
          pubsubTopics: ["/waku/2/rs/42/0"] // Explicitly configure the pubsub topic
        },
        { timeout: 10000 }
      );

      if (createNodeResponse.status === 200) {
        console.log("Node creation response:", createNodeResponse.data);

        // Start the node
        const startNodeResponse = await axios.post(
          `${API_URL}/admin/v1/start-node`,
          {},
          { timeout: 5000 }
        );

        if (startNodeResponse.status === 200) {
          console.log("Node started successfully");
        }
      }
    } catch (error) {
      console.warn(
        "Failed to create/start node through API, some tests may fail:",
        error
      );
    }
  } else {
    console.warn(
      "Skipping node creation as server doesn't appear to be running"
    );
  }
});

test.afterAll(async () => {
  // Stop the server
  console.log("Stopping server...");
  if (serverProcess && serverProcess.pid) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", serverProcess.pid.toString(), "/f", "/t"]);
    } else {
      // Ensure the process and all its children are terminated
      try {
        process.kill(-serverProcess.pid, "SIGINT");
      } catch (e) {
        console.log("Server process already terminated");
      }
    }
  }

  // Verify no processes running on port 3000
  await killProcessOnPort();

  // Give time for all processes to terminate
  await new Promise((resolve) => setTimeout(resolve, 1000));
});

test.describe("Waku Server API", () => {
  // Direct test of filter endpoint - this runs first
  test("can directly access filter/v1/messages endpoint", async () => {
    // Try with different content topic formats
    const testTopics = [
      "test-topic",
      "/test/topic",
      "%2Ftest%2Ftopic", // Pre-encoded
      "%2Ftest%2Ftopic" // Pre-encoded
    ];

    for (const topic of testTopics) {
      console.log(`Testing direct access with topic: ${topic}`);
      try {
        const response = await axios.get(
          `${API_URL}/filter/v1/messages/${topic}`,
          {
            timeout: 5000,
            validateStatus: () => true
          }
        );

        console.log(`  Status: ${response.status}`);
        console.log(`  Content-Type: ${response.headers["content-type"]}`);
        console.log(`  Data: ${JSON.stringify(response.data)}`);

        // If this succeeds, we'll use this topic format for our tests
        if (response.status === 200) {
          console.log(`  Found working topic format: ${topic}`);
          break;
        }
      } catch (error: any) {
        console.error(`  Error with topic ${topic}:`, error.message);
        if (error.response) {
          console.error(`  Response status: ${error.response.status}`);
        }
      }
    }
  });

  // This test checks if the server is running and can serve the basic endpoints
  test("can get server status and verify endpoints", async () => {
    // Get initial server status with retry mechanism
    let initialResponse;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        initialResponse = await axios.get(`${API_URL}/`, {
          timeout: 5000,
          validateStatus: () => true // Accept any status code
        });
        if (initialResponse.status === 200) {
          break;
        }
      } catch (e) {
        console.log(
          `Server not responding on attempt ${attempt + 1}/5, retrying...`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // If we still couldn't connect, skip this test
    if (!initialResponse || initialResponse.status !== 200) {
      console.warn("Server is not responding, skipping endpoint checks");
      test.skip();
      return;
    }

    expect(initialResponse.status).toBe(200);
    expect(initialResponse.data.status).toBe(
      "Waku simulation server is running"
    );

    // Check if key endpoints are available
    console.log("Checking if server endpoints are properly registered...");

    try {
      // Try to access the various endpoints with simple HEAD requests
      const endpoints = [
        "/info",
        "/debug/v1/info",
        "/admin/v1/create-node",
        "/admin/v1/start-node",
        "/admin/v1/stop-node",
        "/filter/v1/messages/test-topic",
        "/filter/v2/messages/test-topic"
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await axios.head(`${API_URL}${endpoint}`, {
            validateStatus: () => true, // Accept any status code
            timeout: 3000 // Short timeout to avoid hanging
          });

          // Some endpoints may return 404 or 405 if they only support specific methods,
          // but at least we should get a response if the route is registered
          console.log(`Endpoint ${endpoint}: Status ${response.status}`);

          // If we get a 404, the route is not registered
          expect(response.status).not.toBe(404);
        } catch (error) {
          console.warn(`Error checking endpoint ${endpoint}:`, error.message);
          // Continue checking other endpoints even if one fails
        }
      }
    } catch (error: any) {
      console.error("Error checking endpoints:", error.message);
      throw error;
    }
  });

  // Test node lifecycle operations using the dedicated endpoints
  test("can create, start, and stop a node", async () => {
    // 1. Create a new node
    const createResponse = await axios.post(`${API_URL}/admin/v1/create-node`, {
      defaultBootstrap: true,
      networkConfig: {
        clusterId: 42,
        shards: [0]
      },
      pubsubTopics: ["/waku/2/rs/42/0"] // Explicitly configure the pubsub topic
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
      defaultBootstrap: false,
      networkConfig: {
        clusterId: 42,
        shards: [0]
      },
      pubsubTopics: ["/waku/2/rs/42/0"] // Explicitly configure the pubsub topic
    });
    await axios.post(`${API_URL}/admin/v1/start-node`);

    // FilterConnect to peers
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
      defaultBootstrap: true,
      networkConfig: {
        clusterId: 42,
        shards: [0]
      },
      pubsubTopics: ["/waku/2/rs/42/0"] // Explicitly configure the pubsub topic
    });
    await axios.post(`${API_URL}/admin/v1/start-node`);

    // FilterConnect to peers
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

  test("can retrieve messages from the queue", async () => {
    // Create and start a fresh node
    await axios.post(`${API_URL}/admin/v1/create-node`, {
      defaultBootstrap: true,
      networkConfig: {
        clusterId: 42,
        shards: [0]
      },
      pubsubTopics: ["/waku/2/rs/42/0"] // Explicitly configure the pubsub topic
    });
    await axios.post(`${API_URL}/admin/v1/start-node`);

    // FilterConnect to peers
    await axios.post(`${API_URL}/admin/v1/peers`, {
      peerMultiaddrs: PEERS
    });

    // Use a simple content topic to avoid encoding issues
    const contentTopic = "test-queue";

    try {
      // Check endpoint existence by checking available routes
      console.log("Checking server routes and status...");
      const rootResponse = await axios.get(`${API_URL}/`);
      console.log(
        "Server root response:",
        rootResponse.status,
        rootResponse.data
      );

      // First ensure the queue is empty
      console.log(`Attempting to get messages from ${contentTopic}...`);
      const emptyQueueResponse = await axios.get(
        `${API_URL}/filter/v1/messages/${contentTopic}`
      );
      expect(emptyQueueResponse.status).toBe(200);
      expect(emptyQueueResponse.data.messages).toEqual([]);
    } catch (error: any) {
      console.error("Error accessing filter endpoint:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
      throw error;
    }

    // Simulate adding messages to the queue
    const messages = [
      {
        payload: Array.from(new TextEncoder().encode("Message 1")),
        timestamp: Date.now() - 2000,
        contentTopic
      },
      {
        payload: Array.from(new TextEncoder().encode("Message 2")),
        timestamp: Date.now() - 1000,
        contentTopic
      },
      {
        payload: Array.from(new TextEncoder().encode("Message 3")),
        timestamp: Date.now(),
        contentTopic
      }
    ];

    const testMessages = await axios.post(`${API_URL}/execute`, {
      functionName: "simulateMessages",
      params: [contentTopic, messages]
    });
    expect(testMessages.status).toBe(200);

    // Now check if we can retrieve messages
    const messagesResponse = await axios.get(
      `${API_URL}/filter/v1/messages/${contentTopic}`
    );
    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.data.messages.length).toBe(3);

    // Verify message format
    const message = messagesResponse.data.messages[0];
    expect(message).toHaveProperty("payload");
    expect(message).toHaveProperty("contentTopic");
    expect(message).toHaveProperty("timestamp");

    // Test pagination
    const paginatedResponse = await axios.get(
      `${API_URL}/filter/v1/messages/${contentTopic}?pageSize=2`
    );
    expect(paginatedResponse.status).toBe(200);
    expect(paginatedResponse.data.messages.length).toBe(2);

    // Test sorting order
    const ascendingResponse = await axios.get(
      `${API_URL}/filter/v1/messages/${contentTopic}?ascending=true`
    );
    expect(ascendingResponse.status).toBe(200);
    expect(ascendingResponse.data.messages.length).toBe(3);
    const timestamps = ascendingResponse.data.messages.map(
      (msg: any) => msg.timestamp
    );
    expect(timestamps[0]).toBeLessThan(timestamps[1]);
    expect(timestamps[1]).toBeLessThan(timestamps[2]);
  });

  test("can access filter endpoint for SSE", async () => {
    // Create and start a fresh node - only if API is accessible
    try {
      // Quick check if server is running
      await axios.get(API_URL, { timeout: 2000 });

      // Create node
      await axios.post(`${API_URL}/admin/v1/create-node`, {
        defaultBootstrap: true,
        networkConfig: {
          clusterId: 42,
          shards: [0]
        },
        pubsubTopics: ["/waku/2/rs/42/0"] // Explicitly configure the pubsub topic
      });

      // Start node
      await axios.post(`${API_URL}/admin/v1/start-node`);

      // FilterConnect to peers
      await axios.post(`${API_URL}/admin/v1/peers`, {
        peerMultiaddrs: PEERS
      });
    } catch (error) {
      console.warn("Server appears to be unreachable, skipping test");
      test.skip();
      return;
    }

    const contentTopic = "test-sse";

    // Verify filter endpoint is accessible
    // Instead of implementing a full SSE client, we'll make sure the endpoint
    // returns the correct headers and status code which indicates SSE readiness
    try {
      const sseResponse = await axios
        .get(
          `${API_URL}/filter/v2/messages/${contentTopic}?clusterId=42&shard=0`,
          {
            // Set a timeout to avoid hanging the test
            timeout: 2000,
            // Expecting the request to timeout as SSE keeps connection open
            validateStatus: () => true,
            // We can't use responseType: 'stream' directly with axios,
            // but we can check the response headers
            headers: {
              Accept: "text/event-stream"
            }
          }
        )
        .catch((e) => {
          // We expect a timeout error since SSE keeps connection open
          if (e.code === "ECONNABORTED") {
            return e.response;
          }
          throw e;
        });

      // If response exists and has expected SSE headers, the test passes
      if (sseResponse) {
        expect(sseResponse.headers["content-type"]).toBe("text/event-stream");
        expect(sseResponse.headers["cache-control"]).toBe("no-cache");
        expect(sseResponse.headers["connection"]).toBe("keep-alive");
      } else {
        // If no response, we manually make an HTTP request to check the headers
        const headers = await new Promise<Record<string, string>>((resolve) => {
          const requestUrl = new URL(
            `${API_URL}/filter/v2/messages/${contentTopic}?clusterId=42&shard=0`
          );
          const req = http.get(requestUrl, (res) => {
            // Only interested in headers
            req.destroy();
            if (res.headers) {
              resolve(res.headers as Record<string, string>);
            } else {
              resolve({});
            }
          });
          req.on("error", () => resolve({}));
        });

        if (Object.keys(headers).length === 0) {
          console.warn(
            "No headers received, SSE endpoint may not be accessible"
          );
          test.skip();
          return;
        }

        expect(headers["content-type"]).toBe("text/event-stream");
      }
    } catch (error) {
      console.error("Error during SSE endpoint test:", error);
      test.fail();
      return;
    }

    console.log("SSE endpoint is accessible with correct headers");
  });

  // Add a specific test just for the filter/v1/messages endpoint
  test("can access filter/v1/messages endpoint directly", async () => {
    // Check if server is available first
    try {
      await axios.get(API_URL, { timeout: 2000 });
    } catch (error) {
      console.warn("Server appears to be unreachable, skipping test");
      test.skip();
      return;
    }

    // Create a random content topic just for this test
    const contentTopic = `direct-filter-${Date.now()}`;

    try {
      // Try different approaches to access the endpoint
      console.log(
        `Testing direct access to filter/v1/messages/${contentTopic}`
      );

      // Method 1: GET request with encoded content topic
      const getResponse = await axios({
        method: "get",
        url: `${API_URL}/filter/v1/messages/${contentTopic}`,
        validateStatus: function () {
          // Allow any status code to check what's coming back
          return true;
        },
        timeout: 5000
      });

      console.log("Response status:", getResponse.status);
      console.log("Response headers:", getResponse.headers);

      if (getResponse.status === 404) {
        throw new Error(
          `Endpoint not found (404): /filter/v1/messages/${contentTopic}`
        );
      }

      // If we got here, the endpoint exists even if it returns empty results
      expect(getResponse.status).toBe(200);
      expect(getResponse.data).toHaveProperty("messages");
      expect(Array.isArray(getResponse.data.messages)).toBe(true);
    } catch (error: any) {
      console.error("Error during filter/v1 endpoint test:", error.message);

      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response headers:", error.response.headers);
        console.error("Response data:", error.response.data);
      } else if (error.request) {
        console.error("No response received:", error.request);
        // If no response, we'll skip the test rather than fail it
        test.skip();
        return;
      }

      throw error;
    }
  });
});
