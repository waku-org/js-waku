/* eslint-disable no-console */
import { ChildProcess, exec } from "child_process";
import * as net from "net";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { Browser, chromium, Page } from "@playwright/test";
import { LightNode } from "@waku/sdk";
import cors from "cors";
import express, { Request, Response } from "express";

import { IWakuNode } from "./api/common.js";
import {
  createWakuNode,
  dialPeers,
  getDebugInfo,
  getPeerInfo,
  pushMessage,
  subscribe
} from "./api/shared.js";

// Define types for the Waku node and window
declare global {
  interface Window {
    waku: IWakuNode & LightNode;
    wakuAPI: {
      getPeerInfo: typeof getPeerInfo;
      getDebugInfo: typeof getDebugInfo;
      pushMessage: typeof pushMessage;
      dialPeers: typeof dialPeers;
      createWakuNode: typeof createWakuNode;
      subscribe: typeof subscribe;
      [key: string]: any;
    };
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());

// Global variable to store the browser and page
let browser: Browser | undefined;
let page: Page | undefined;
let headlessServerProcess: ChildProcess | undefined;

// Message queue to store received messages by content topic
interface MessageQueue {
  [contentTopic: string]: Array<{
    payload: number[] | undefined;
    contentTopic: string;
    timestamp: number;
    receivedAt: number;
  }>;
}

const messageQueue: MessageQueue = {};

// Start the headless app server on port 8080
async function startHeadlessServer(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      console.log("Starting headless app server...");
      headlessServerProcess = exec(
        `serve ${join(__dirname, "../headless")} -p 8080 -s`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error starting serve: ${error}`);
            return;
          }
          console.log(`serve stdout: ${stdout}`);
          console.error(`serve stderr: ${stderr}`);
        }
      );

      // Wait a moment to ensure the server is running
      setTimeout(resolve, 2000);
    } catch (error) {
      console.error("Failed to start headless server:", error);
      // Resolve anyway, we'll handle the missing server gracefully
      resolve();
    }
  });
}

// Initialize browser and load headless page
async function initBrowser(): Promise<void> {
  try {
    console.log("Initializing browser...");
    browser = await chromium.launch({
      headless: true
    });

    if (!browser) {
      throw new Error("Failed to initialize browser");
    }

    console.log("Creating new page...");
    page = await browser.newPage();

    // Navigate to the headless app
    console.log("Navigating to headless app...");
    try {
      // Check if the server is running first
      await checkServerAvailability("http://localhost:8080", 3);
      await page.goto("http://localhost:8080");
      console.log("Browser and Waku initialized successfully!");
    } catch (error) {
      console.error(
        "Error loading headless app, continuing without it:",
        error
      );
      // Create an empty page instead
      await page.setContent(`
        <html>
          <head><title>Waku Test Environment</title></head>
          <body>
            <h1>Waku Test Environment (No headless app available)</h1>
            <script>
              window.waku = {};
              window.wakuAPI = {
                getPeerInfo: () => ({ peerId: "mock-peer-id", multiaddrs: [], peers: [] }),
                getDebugInfo: () => ({ listenAddresses: [], peerId: "mock-peer-id", protocols: [] }),
                pushMessage: () => ({ successes: [], failures: [{ error: "No headless app available" }] }),
                dialPeers: () => ({ total: 0, errors: ["No headless app available"] }),
                createWakuNode: () => ({ success: true, message: "Mock node created" }),
                startNode: () => ({ success: true }),
                stopNode: () => ({ success: true }),
                subscribe: () => ({ unsubscribe: async () => {} })
              };
            </script>
          </body>
        </html>
      `);
      console.log("Created mock Waku environment");
    }
  } catch (error) {
    console.error("Error initializing browser:", error);
    throw error;
  }
}

// Helper function to check if a server is available
async function checkServerAvailability(
  url: string,
  retries = 3
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return true;
    } catch (e) {
      console.log(`Server at ${url} not available, retry ${i + 1}/${retries}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Server at ${url} not available after ${retries} retries`);
}

// Helper function to check if a port is available
async function findAvailablePort(
  startPort: number,
  maxAttempts = 10
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort + attempt;
    try {
      // Try to create a server on the port
      await new Promise<void>((resolve, reject) => {
        const server = net
          .createServer()
          .once("error", (err: any) => {
            reject(err);
          })
          .once("listening", () => {
            // If we can listen, the port is available
            server.close();
            resolve();
          })
          .listen(port);
      });

      // If we get here, the port is available
      console.log(`Found available port: ${port}`);
      return port;
    } catch (err) {
      console.log(`Port ${startPort + attempt} is not available`);
    }
  }

  // If we tried all ports and none are available, throw an error
  throw new Error(
    `Unable to find an available port after ${maxAttempts} attempts`
  );
}

// Start the server and initialize the browser
async function startServer(port: number = 3000): Promise<void> {
  try {
    // Start the headless app server first
    await startHeadlessServer();

    // Initialize the browser
    await initBrowser();

    // Start the API server
    await startAPI(port);
  } catch (error: any) {
    console.error("Error starting server:", error);
    // Don't exit - let the test handle the error
  }
}

// Main server function
async function startAPI(requestedPort: number): Promise<void> {
  try {
    // Define API endpoints
    app.get("/", (_req: Request, res: Response) => {
      res.json({ status: "Waku simulation server is running" });
    });

    // Get node info endpoint
    app.get("/info", (async (_req: Request, res: Response) => {
      try {
        const result = await page?.evaluate(() => {
          return window.wakuAPI.getPeerInfo(window.waku);
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error getting info:", error);
        res.status(500).json({ error: error.message });
      }
    }) as express.RequestHandler);

    // Get node debug info endpoint
    app.get("/debug/v1/info", (async (_req: Request, res: Response) => {
      try {
        const result = await page?.evaluate(() => {
          return window.wakuAPI.getDebugInfo(window.waku);
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error getting debug info:", error);
        res.status(500).json({ error: error.message });
      }
    }) as express.RequestHandler);

    // Update to match Waku REST API format
    app.post("/lightpush/v1/message", (async (req: Request, res: Response) => {
      try {
        const { pubsubTopic, message } = req.body;

        if (!message || !message.contentTopic) {
          return res.status(400).json({
            code: 400,
            message: "Invalid request. contentTopic is required."
          });
        }

        const result = await page?.evaluate(
          ({ contentTopic, payload }) => {
            return window.wakuAPI.pushMessage(
              window.waku,
              contentTopic,
              payload
            );
          },
          {
            contentTopic: message.contentTopic,
            payload: message.payload
          }
        );

        if (result) {
          res.status(200).json({
            messageId:
              "0x" +
              Buffer.from(
                message.contentTopic + Date.now().toString()
              ).toString("hex")
          });
        } else {
          res.status(503).json({
            code: 503,
            message: "Could not publish message: no suitable peers"
          });
        }
      } catch (error: any) {
        // console.error("Error pushing message:", error);

        // Handle payload size limits based on error
        if (
          error.message.includes("size exceeds") ||
          error.message.includes("stream reset")
        ) {
          res.status(503).json({
            code: 503,

            message:
              "Could not publish message: message size exceeds gossipsub max message size"
          });
        } else {
          res.status(500).json({
            code: 500,
            message: `Could not publish message: ${error.message}`
          });
        }
      }
    }) as express.RequestHandler);

    // Admin endpoints
    app.post("/admin/v1/peers", (async (req: Request, res: Response) => {
      try {
        const { peerMultiaddrs } = req.body;

        if (!peerMultiaddrs || !Array.isArray(peerMultiaddrs)) {
          return res.status(400).json({
            code: 400,
            message: "Invalid request. peerMultiaddrs array is required."
          });
        }

        const result = await page?.evaluate(
          ({ peerAddrs }) => {
            return window.wakuAPI.dialPeers(window.waku, peerAddrs);
          },
          { peerAddrs: peerMultiaddrs }
        );

        if (result) {
          res.status(200).json({
            peersAdded: peerMultiaddrs.length - (result.errors?.length || 0),
            peerErrors:
              result.errors?.map((error: string, index: number) => {
                return {
                  peerMultiaddr: peerMultiaddrs[index],
                  error
                };
              }) || []
          });
        } else {
          res.status(500).json({
            code: 500,
            message: "Failed to dial peers"
          });
        }
      } catch (error: any) {
        console.error("Error dialing peers:", error);
        res.status(500).json({
          code: 500,
          message: `Could not dial peers: ${error.message}`
        });
      }
    }) as express.RequestHandler);

    // NEW ENDPOINT: Create a Waku node
    app.head("/admin/v1/create-node", (_req: Request, res: Response) => {
      res.status(200).end();
    });

    app.post("/admin/v1/create-node", (async (req: Request, res: Response) => {
      try {
        const {
          defaultBootstrap = true,
          networkConfig,
          pubsubTopics
        } = req.body;

        // Log the pubsub topics and network config for debugging
        console.log(
          `Creating node with pubsubTopics: ${JSON.stringify(pubsubTopics)}`
        );
        console.log(`Network config: ${JSON.stringify(networkConfig)}`);

        const result = await page?.evaluate(
          ({ defaultBootstrap, networkConfig, pubsubTopics }) => {
            // Create a properly typed options object for createWakuNode
            // When creating a node, we need to use the correct networkConfig structure
            // for static sharding: { clusterId: number, shards: number[] }
            const nodeOptions: any = {
              defaultBootstrap,
              relay: {
                advertise: true,
                gossipsubOptions: {
                  allowPublishToZeroPeers: true
                }
              },
              filter: true,
              peers: []
            };

            // If network config is provided, use it
            if (networkConfig) {
              // Ensure we have the proper format - static sharding
              if (networkConfig.clusterId !== undefined) {
                nodeOptions.networkConfig = {
                  clusterId: networkConfig.clusterId,
                  shards: networkConfig.shards || [0]
                };

                console.log(
                  `Using static sharding with clusterId=${nodeOptions.networkConfig.clusterId} and shards=[${nodeOptions.networkConfig.shards.join(",")}]`
                );
              }
            }
            // If custom pubsub topics are provided but no network config,
            // try to infer network config from the pubsub topics
            else if (pubsubTopics && pubsubTopics.length > 0) {
              // Try to infer network config from the pubsub topics
              // Example: "/waku/2/rs/42/0" -> clusterId: 42, shards: [0]
              const pubsubConfig = new Map();

              for (const topic of pubsubTopics) {
                const parts = topic.split("/");
                if (
                  parts.length === 6 &&
                  parts[1] === "waku" &&
                  parts[3] === "rs"
                ) {
                  const clusterId = parseInt(parts[4]);
                  const shard = parseInt(parts[5]);

                  if (!isNaN(clusterId) && !isNaN(shard)) {
                    if (!pubsubConfig.has(clusterId)) {
                      pubsubConfig.set(clusterId, new Set());
                    }
                    pubsubConfig.get(clusterId).add(shard);
                  }
                }
              }

              // Use the first cluster ID and its shards if found
              if (pubsubConfig.size > 0) {
                const firstClusterId = Array.from(pubsubConfig.keys())[0];
                const shards = Array.from(pubsubConfig.get(firstClusterId));

                nodeOptions.networkConfig = {
                  clusterId: firstClusterId,
                  shards: shards
                };

                console.log(
                  `Inferred network config from pubsub topics: clusterId=${firstClusterId}, shards=[${shards.join(",")}]`
                );
              } else {
                // Default to cluster ID 42, shard 0 as per the tests
                nodeOptions.networkConfig = {
                  clusterId: 42,
                  shards: [0]
                };
                console.log(
                  `Using default network config: clusterId=42, shards=[0]`
                );
              }
            } else {
              // Default to cluster ID 42, shard 0 as per the tests
              nodeOptions.networkConfig = {
                clusterId: 42,
                shards: [0]
              };
              console.log(
                `Using default network config: clusterId=42, shards=[0]`
              );
            }

            return window.wakuAPI.createWakuNode(nodeOptions);
          },
          { defaultBootstrap, networkConfig, pubsubTopics }
        );

        if (result && result.success) {
          res.status(200).json({
            success: true,
            message: "Waku node created successfully"
          });
        } else {
          res.status(500).json({
            code: 500,
            message: "Failed to create Waku node",
            details: result?.error || "Unknown error"
          });
        }
      } catch (error: any) {
        console.error("Error creating Waku node:", error);
        res.status(500).json({
          code: 500,
          message: `Could not create Waku node: ${error.message}`
        });
      }
    }) as express.RequestHandler);

    // NEW ENDPOINT: Start the Waku node
    app.head("/admin/v1/start-node", (_req: Request, res: Response) => {
      res.status(200).end();
    });

    app.post("/admin/v1/start-node", (async (_req: Request, res: Response) => {
      try {
        const result = await page?.evaluate(() => {
          return window.wakuAPI.startNode
            ? window.wakuAPI.startNode()
            : { error: "startNode function not available" };
        });

        if (result && !result.error) {
          res.status(200).json({
            success: true,
            message: "Waku node started successfully"
          });
        } else {
          res.status(500).json({
            code: 500,
            message: "Failed to start Waku node",
            details: result?.error || "Unknown error"
          });
        }
      } catch (error: any) {
        console.error("Error starting Waku node:", error);
        res.status(500).json({
          code: 500,
          message: `Could not start Waku node: ${error.message}`
        });
      }
    }) as express.RequestHandler);

    // NEW ENDPOINT: Stop the Waku node
    app.head("/admin/v1/stop-node", (_req: Request, res: Response) => {
      res.status(200).end();
    });

    app.post("/admin/v1/stop-node", (async (_req: Request, res: Response) => {
      try {
        const result = await page?.evaluate(() => {
          return window.wakuAPI.stopNode
            ? window.wakuAPI.stopNode()
            : { error: "stopNode function not available" };
        });

        if (result && !result.error) {
          res.status(200).json({
            success: true,
            message: "Waku node stopped successfully"
          });
        } else {
          res.status(500).json({
            code: 500,
            message: "Failed to stop Waku node",
            details: result?.error || "Unknown error"
          });
        }
      } catch (error: any) {
        console.error("Error stopping Waku node:", error);
        res.status(500).json({
          code: 500,
          message: `Could not stop Waku node: ${error.message}`
        });
      }
    }) as express.RequestHandler);

    // Filter endpoint for subscribing to messages on a specific content topic
    app.get("/filter/v2/messages/:contentTopic", (async (
      req: Request,
      res: Response
    ) => {
      try {
        const { contentTopic } = req.params;
        const { clusterId, shard } = req.query;

        // Convert string query params to numbers if provided
        const options = {
          clusterId: clusterId ? parseInt(clusterId as string, 10) : 42, // Default to match node creation
          shard: shard ? parseInt(shard as string, 10) : 0 // Default to match node creation
        };

        console.log(
          `Subscribing to content topic ${contentTopic} with clusterId=${options.clusterId}, shard=${options.shard}`
        );

        // Set up SSE (Server-Sent Events)
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Function to send SSE
        const sendSSE = (data: any): void => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Subscribe to messages
        await page?.evaluate(
          ({ contentTopic, options }) => {
            // Message handler that will send messages back to the client
            const callback = (message: any): void => {
              // Post message to the browser context
              window.postMessage(
                {
                  type: "WAKU_MESSAGE",
                  payload: {
                    payload: message.payload
                      ? Array.from(message.payload)
                      : undefined,
                    contentTopic: message.contentTopic,
                    timestamp: message.timestamp
                  }
                },
                "*"
              );
            };

            // Simple approach - subscribe directly and don't try to handle unsubscribe
            // The subscription will be automatically cleaned up when the page is reloaded
            return window.wakuAPI.subscribe(
              window.waku,
              contentTopic,
              options,
              callback
            );
          },
          { contentTopic, options }
        );

        // Set up event listener for messages from the page
        await page?.exposeFunction("sendMessageToServer", (message: any) => {
          // Send the message as SSE
          sendSSE(message);

          // Also store in the message queue with a timestamp
          const topic = message.contentTopic;
          if (!messageQueue[topic]) {
            messageQueue[topic] = [];
          }

          // Add message to queue with received timestamp
          messageQueue[topic].push({
            ...message,
            receivedAt: Date.now()
          });

          // Limit queue size to 1000 messages per topic
          if (messageQueue[topic].length > 1000) {
            messageQueue[topic].shift(); // Remove oldest message
          }
        });

        // Add event listener in the browser context to forward messages to the server
        await page?.evaluate(() => {
          window.addEventListener("message", (event) => {
            if (event.data.type === "WAKU_MESSAGE") {
              (window as any).sendMessageToServer(event.data.payload);
            }
          });
        });

        // Handle client disconnect
        req.on("close", () => {
          console.log(
            `Client disconnected from filter stream for ${contentTopic}`
          );
          // We'll rely on browser/page reload to clean up subscriptions
        });
      } catch (error: any) {
        console.error("Error in filter subscription:", error);
        // For SSE, we need to send the error as an event
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }) as express.RequestHandler);

    // Endpoint to retrieve messages from the queue (pull-based approach)
    app.get("/filter/v1/messages/:contentTopic", (async (
      req: Request,
      res: Response
    ) => {
      try {
        console.log(
          `Received request for filter messages: ${req.params.contentTopic}`
        );
        const { contentTopic } = req.params;
        const {
          pageSize = "20",
          startTime,
          endTime,
          ascending = "false"
        } = req.query;

        // Ensure the content topic exists in the queue
        if (!messageQueue[contentTopic]) {
          console.log(
            `No messages in queue for topic: ${contentTopic}, returning empty array`
          );
          return res.status(200).json({ messages: [] });
        }

        // Convert query parameters
        const limit = parseInt(pageSize as string, 10);
        const isAscending = (ascending as string).toLowerCase() === "true";
        const timeStart = startTime ? parseInt(startTime as string, 10) : 0;
        const timeEnd = endTime ? parseInt(endTime as string, 10) : Date.now();

        // Filter and sort messages
        const filteredMessages = messageQueue[contentTopic]
          .filter((msg) => {
            const msgTime = msg.timestamp || msg.receivedAt;
            return msgTime >= timeStart && msgTime <= timeEnd;
          })
          .sort((a, b) => {
            const timeA = a.timestamp || a.receivedAt;
            const timeB = b.timestamp || b.receivedAt;
            return isAscending ? timeA - timeB : timeB - timeA;
          })
          .slice(0, limit);

        console.log(
          `Returning ${filteredMessages.length} messages for topic: ${contentTopic}`
        );

        // Format response to match Waku REST API format
        const response = {
          messages: filteredMessages.map((msg) => ({
            payload: msg.payload
              ? Buffer.from(msg.payload).toString("base64")
              : "",
            contentTopic: msg.contentTopic,
            timestamp: msg.timestamp,
            version: 0 // Default version
          }))
        };

        res.status(200).json(response);
      } catch (error: any) {
        console.error("Error retrieving messages:", error);
        res.status(500).json({
          code: 500,
          message: `Failed to retrieve messages: ${error.message}`
        });
      }
    }) as express.RequestHandler);

    // Helper endpoint for executing functions (useful for testing)
    app.post("/execute", (async (req: Request, res: Response) => {
      try {
        const { functionName, params = [] } = req.body;

        if (functionName === "simulateMessages") {
          // Special case for simulating messages in the queue
          const [contentTopic, messages] = params;

          if (!messageQueue[contentTopic]) {
            messageQueue[contentTopic] = [];
          }

          // Add messages to the queue
          for (const msg of messages) {
            messageQueue[contentTopic].push({
              ...msg,
              contentTopic,
              receivedAt: Date.now()
            });
          }

          return res.status(200).json({
            success: true,
            messagesAdded: messages.length
          });
        }

        // For other function calls, evaluate in the browser context
        const result = await page?.evaluate(
          ({ fnName, fnParams }) => {
            if (!window.wakuAPI[fnName]) {
              return { error: `Function ${fnName} not found` };
            }
            return window.wakuAPI[fnName](...fnParams);
          },
          { fnName: functionName, fnParams: params }
        );

        res.status(200).json(result);
      } catch (error: any) {
        console.error(
          `Error executing function ${req.body.functionName}:`,
          error
        );
        res.status(500).json({
          error: error.message
        });
      }
    }) as express.RequestHandler);

    // Log all registered routes - this is useful for debugging
    console.log("\n======= Registered Routes =======");
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // Routes registered directly on the app
        const path = middleware.route.path;
        const methods = Object.keys(middleware.route.methods)
          .filter((method) => middleware.route.methods[method])
          .join(", ")
          .toUpperCase();
        console.log(`${methods} ${path}`);
      } else if (middleware.name === "router") {
        // Router middleware
        middleware.handle.stack.forEach((handler: any) => {
          if (handler.route) {
            const path = handler.route.path;
            const methods = Object.keys(handler.route.methods)
              .filter((method) => handler.route.methods[method])
              .join(", ")
              .toUpperCase();
            console.log(`${methods} ${path}`);
          }
        });
      }
    });
    console.log("=================================\n");

    // Start Express server on the first available port
    let actualPort: number;
    try {
      actualPort = await findAvailablePort(requestedPort);
    } catch (error) {
      console.error("Failed to find an available port:", error);
      throw error;
    }

    app
      .listen(actualPort, () => {
        console.log(`API server running on http://localhost:${actualPort}`);
      })
      .on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          console.error(
            `Port ${actualPort} is already in use. Please close the application using this port and try again.`
          );
          // Don't exit - tests might still be running and we don't want to terminate the process
          // Instead, we'll let the test handle the error
        } else {
          console.error("Error starting server:", error);
        }
      });

    return Promise.resolve();
  } catch (error: any) {
    console.error("Error starting server:", error);
    // Don't exit - let the test handle the error
    return Promise.reject(error);
  }
}

// Handle graceful shutdown
process.on("SIGINT", (async () => {
  console.log("Shutting down...");
  if (browser) {
    await browser.close();
  }

  if (headlessServerProcess && headlessServerProcess.pid) {
    try {
      process.kill(headlessServerProcess.pid);
    } catch (e) {
      console.log("Headless server already stopped");
    }
  }

  process.exit(0);
}) as any);

// Using ES module detection instead of require.main
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  void startServer(port);
}
