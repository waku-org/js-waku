import { ChildProcess, exec } from "child_process";
import * as net from "net";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { chromium } from "@playwright/test";
import cors from "cors";
import express, { Request, Response } from "express";

import adminRouter from "./routes/admin.js";
import { setPage, getPage, closeBrowser } from "./browser/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(adminRouter);

let headlessServerProcess: ChildProcess | undefined;

interface MessageQueue {
  [contentTopic: string]: Array<{
    payload: number[] | undefined;
    contentTopic: string;
    timestamp: number;
    receivedAt: number;
  }>;
}

const messageQueue: MessageQueue = {};

async function startHeadlessServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      headlessServerProcess = exec(
        `serve ${join(__dirname, "../../headless-tests")} -p 8080 -s`,
        (error) => {
          if (error) {
            console.error(`Error starting serve: ${error}`);
            return;
          }
        }
      );

      setTimeout(resolve, 2000);
    } catch (error) {
      console.error("Failed to start headless server:", error);
      reject(error);
    }
  });
}

async function initBrowser(): Promise<void> {
  try {
    const browser = await chromium.launch({
      headless: true
    });

    if (!browser) {
      throw new Error("Failed to initialize browser");
    }

    const page = await browser.newPage();

    try {
      await checkServerAvailability("http://localhost:8080", 3);
      await page.goto("http://localhost:8080");
    } catch (error) {
      console.error(
        "Error loading headless app, continuing without it:",
        error
      );
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
    }

    setPage(page);
  } catch (error) {
    console.error("Error initializing browser:", error);
    throw error;
  }
}

async function checkServerAvailability(
  url: string,
  retries = 3
): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) return true;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Server at ${url} not available after ${retries} retries`);
}

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
      return port;
    } catch (err) {
      // Port is not available, continue to next port
    }
  }

  // If we tried all ports and none are available, throw an error
  throw new Error(
    `Unable to find an available port after ${maxAttempts} attempts`
  );
}

async function startServer(port: number = 3000): Promise<void> {
  try {
    await startHeadlessServer();

    await initBrowser();

    await startAPI(port);
  } catch (error: any) {
    console.error("Error starting server:", error);
  }
}

async function startAPI(requestedPort: number): Promise<void> {
  try {
    app.get("/", (_req: Request, res: Response) => {
      res.json({ status: "Waku simulation server is running" });
    });

    app.get("/info", (async (_req: Request, res: Response) => {
      try {
        const result = await getPage()?.evaluate(() => {
          return window.wakuAPI.getPeerInfo(window.waku);
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error getting info:", error);
        res.status(500).json({ error: error.message });
      }
    }) as express.RequestHandler);

    app.get("/debug/v1/info", (async (_req: Request, res: Response) => {
      try {
        const result = await getPage()?.evaluate(() => {
          return window.wakuAPI.getDebugInfo(window.waku);
        });

        res.json(result);
      } catch (error: any) {
        console.error("Error getting debug info:", error);
        res.status(500).json({ error: error.message });
      }
    }) as express.RequestHandler);

    app.post("/lightpush/v1/message", (async (req: Request, res: Response) => {
      try {
        const { message } = req.body;

        if (!message || !message.contentTopic) {
          return res.status(400).json({
            code: 400,
            message: "Invalid request. contentTopic is required."
          });
        }

        const result = await getPage()?.evaluate(
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

    app.get("/filter/v2/messages/:contentTopic", (async (
      req: Request,
      res: Response
    ) => {
      try {
        const { contentTopic } = req.params;
        const { clusterId, shard } = req.query;

        const options = {
          clusterId: clusterId ? parseInt(clusterId as string, 10) : 42, // Default to match node creation
          shard: shard ? parseInt(shard as string, 10) : 0 // Default to match node creation
        };


        // Set up SSE (Server-Sent Events)
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Function to send SSE
        const sendSSE = (data: any): void => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Subscribe to messages
        await getPage()?.evaluate(
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
        await getPage()?.exposeFunction("sendMessageToServer", (message: any) => {
          // Send the message as SSE
          sendSSE(message);

          const topic = message.contentTopic;
          if (!messageQueue[topic]) {
            messageQueue[topic] = [];
          }

          messageQueue[topic].push({
            ...message,
            receivedAt: Date.now()
          });

          if (messageQueue[topic].length > 1000) {
            messageQueue[topic].shift();
          }
        });

        // Add event listener in the browser context to forward messages to the server
        await getPage()?.evaluate(() => {
          window.addEventListener("message", (event) => {
            if (event.data.type === "WAKU_MESSAGE") {
              (window as any).sendMessageToServer(event.data.payload);
            }
          });
        });

        req.on("close", () => {
        });
      } catch (error: any) {
        console.error("Error in filter subscription:", error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }) as express.RequestHandler);

    app.get("/filter/v1/messages/:contentTopic", (async (
      req: Request,
      res: Response
    ) => {
      try {
        const { contentTopic } = req.params;
        const {
          pageSize = "20",
          startTime,
          endTime,
          ascending = "false"
        } = req.query;

        if (!messageQueue[contentTopic]) {
          return res.status(200).json({ messages: [] });
        }

        const limit = parseInt(pageSize as string, 10);
        const isAscending = (ascending as string).toLowerCase() === "true";
        const timeStart = startTime ? parseInt(startTime as string, 10) : 0;
        const timeEnd = endTime ? parseInt(endTime as string, 10) : Date.now();

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

        const result = await getPage()?.evaluate(
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


    let actualPort: number;
    try {
      actualPort = await findAvailablePort(requestedPort);
    } catch (error) {
      console.error("Failed to find an available port:", error);
      throw error;
    }

    app
      .listen(actualPort, () => {
      })
      .on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          console.error(
            `Port ${actualPort} is already in use. Please close the application using this port and try again.`
          );
        } else {
          console.error("Error starting server:", error);
        }
      });

    return Promise.resolve();
  } catch (error: any) {
    console.error("Error starting server:", error);
    return Promise.reject(error);
  }
}

process.on("SIGINT", (async () => {
  await closeBrowser();

  if (headlessServerProcess && headlessServerProcess.pid) {
    try {
      process.kill(headlessServerProcess.pid);
    } catch (e) {
      // Process already stopped
    }
  }

  process.exit(0);
}) as any);

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  void startServer(port);
}
