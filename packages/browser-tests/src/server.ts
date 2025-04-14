/* eslint-disable no-console */
import { exec } from "child_process";
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
  pushMessage
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
      [key: string]: any;
    };
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Global variable to store the browser and page
let browser: Browser | undefined;
let page: Page | undefined;

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
    await page.goto("http://localhost:8080");

    // Wait for Waku to initialize
    // console.log("Waiting for Waku to initialize...");
    // await page.waitForFunction(() => window.waku !== undefined, {
    //   timeout: 30000
    // });

    console.log("Browser and Waku initialized successfully!");
  } catch (error) {
    console.error("Error initializing browser:", error);
    throw error;
  }
}

// Start the server and initialize the browser
async function startServer(): Promise<void> {
  try {
    // Start serving the headless app
    console.log("Starting headless app server...");
    const serverProcess = exec(
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
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Initialize the browser
    await initBrowser();

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
    app.post("/admin/v1/create-node", (async (req: Request, res: Response) => {
      try {
        const options = req.body || {};

        const result = await page?.evaluate((nodeOptions) => {
          return window.wakuAPI.createWakuNode(nodeOptions);
        }, options);

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

    // Start Express server
    app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
    });
  } catch (error: any) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", (async () => {
  console.log("Shutting down...");
  if (browser) {
    await browser.close();
  }
  process.exit(0);
}) as any);

// Start the server
void startServer();
