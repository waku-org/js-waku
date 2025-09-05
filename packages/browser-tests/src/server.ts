import { fileURLToPath } from "url";
import * as path from "path";

import cors from "cors";
import express, { Request, Response } from "express";

import wakuRouter from "./routes/waku.js";
import { initBrowser, getPage, closeBrowser } from "./browser/index.js";


const app = express();

app.use(cors());
app.use(express.json());

import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distRoot = path.resolve(__dirname, "..");
const webDir = path.resolve(distRoot, "web");

app.get("/app/index.html", (_req: Request, res: Response) => {
  try {
    const htmlPath = path.join(webDir, "index.html");
    let htmlContent = fs.readFileSync(htmlPath, "utf8");

    const networkConfig: any = {};
    if (process.env.WAKU_CLUSTER_ID) {
      networkConfig.clusterId = parseInt(process.env.WAKU_CLUSTER_ID, 10);
    }
    if (process.env.WAKU_SHARD) {
      networkConfig.shards = [parseInt(process.env.WAKU_SHARD, 10)];
    }

    const lightpushNode = process.env.WAKU_LIGHTPUSH_NODE || null;
    const enrBootstrap = process.env.WAKU_ENR_BOOTSTRAP || null;

    const configScript = `    <script>
      window.__WAKU_NETWORK_CONFIG = ${JSON.stringify(networkConfig)};
      window.__WAKU_LIGHTPUSH_NODE = ${JSON.stringify(lightpushNode)};
      window.__WAKU_ENR_BOOTSTRAP = ${JSON.stringify(enrBootstrap)};
    </script>`;
    const originalPattern = '    <script type="module" src="./index.js"></script>';
    const replacement = `${configScript}\n    <script type="module" src="./index.js"></script>`;

    htmlContent = htmlContent.replace(originalPattern, replacement);

    res.setHeader("Content-Type", "text/html");
    res.send(htmlContent);
  } catch (error) {
    console.error("Error serving dynamic index.html:", error);
    res.status(500).send("Error loading page");
  }
});

app.use("/app", express.static(webDir, { index: false }));

app.use(wakuRouter);



async function startAPI(requestedPort: number): Promise<number> {
  try {
    app.get("/", (_req: Request, res: Response) => {
      res.json({ status: "Waku simulation server is running" });
    });


    app
      .listen(requestedPort, () => {
        console.log(`API server running on http://localhost:${requestedPort}`);
      })
      .on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          console.error(
            `Port ${requestedPort} is already in use. Please close the application using this port and try again.`,
          );
        } else {
          console.error("Error starting server:", error);
        }
        throw error;
      });

    return requestedPort;
  } catch (error: any) {
    console.error("Error starting server:", error);
    throw error;
  }
}

async function startServer(port: number = 3000): Promise<void> {
  try {
    const actualPort = await startAPI(port);
    await initBrowser(actualPort);

    try {
      console.log("Auto-starting node with CLI configuration...");

      const hasEnrBootstrap = Boolean(process.env.WAKU_ENR_BOOTSTRAP);
      const networkConfig: any = { 
        defaultBootstrap: !hasEnrBootstrap,
        ...(hasEnrBootstrap && {
          discovery: {
            dns: true,
            peerExchange: true,
            peerCache: true
          }
        })
      };
      
      console.log(`Bootstrap mode: ${hasEnrBootstrap ? 'ENR-only (defaultBootstrap=false)' : 'default bootstrap (defaultBootstrap=true)'}`);
      if (hasEnrBootstrap) {
        console.log(`ENR bootstrap peers: ${process.env.WAKU_ENR_BOOTSTRAP}`);
        console.log(`Discovery options: peerExchange=true, dns=false, peerCache=true`);
      }

      networkConfig.networkConfig = {
        clusterId: process.env.WAKU_CLUSTER_ID ? parseInt(process.env.WAKU_CLUSTER_ID, 10) : 1,
        numShardsInCluster: 8
      };
      
      if (process.env.WAKU_SHARD) {
        networkConfig.networkConfig.shards = [parseInt(process.env.WAKU_SHARD, 10)];
        delete networkConfig.networkConfig.numShardsInCluster;
      }
      
      console.log(`Network config: ${JSON.stringify(networkConfig.networkConfig)}`);

      await getPage()?.evaluate((config) => {
        return window.wakuApi.createWakuNode(config);
      }, networkConfig);
      await getPage()?.evaluate(() => window.wakuApi.startNode());

      try {
        await getPage()?.evaluate(() =>
          window.wakuApi.waitForPeers?.(5000, ["lightpush"] as any),
        );
        console.log("Auto-start completed with bootstrap peers");
      } catch (peerError) {
        console.log("Auto-start completed (no bootstrap peers found - may be expected with test ENRs)");
      }
    } catch (e) {
      console.warn("Auto-start failed:", e);
    }
  } catch (error: any) {
    console.error("Error starting server:", error);
    // Don't exit the process, just log the error
    // The server might still be partially functional
  }
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, gracefully shutting down...`);
  try {
    await closeBrowser();
  } catch (e) {
    console.warn("Error closing browser:", e);
  }
  process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

function parseCliArgs() {
  const args = process.argv.slice(2);
  let clusterId: number | undefined;
  let shard: number | undefined;
  let lightpushNode: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--cluster-id=')) {
      clusterId = parseInt(arg.split('=')[1], 10);
      if (isNaN(clusterId)) {
        console.error('Invalid cluster-id value. Must be a number.');
        process.exit(1);
      }
    } else if (arg.startsWith('--shard=')) {
      shard = parseInt(arg.split('=')[1], 10);
      if (isNaN(shard)) {
        console.error('Invalid shard value. Must be a number.');
        process.exit(1);
      }
    } else if (arg.startsWith('--lightpushnode=')) {
      lightpushNode = arg.split('=')[1];
      if (!lightpushNode || lightpushNode.trim() === '') {
        console.error('Invalid lightpushnode value. Must be a valid multiaddr.');
        process.exit(1);
      }
    }
  }

  return { clusterId, shard, lightpushNode };
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const cliArgs = parseCliArgs();

  if (cliArgs.clusterId !== undefined) {
    process.env.WAKU_CLUSTER_ID = cliArgs.clusterId.toString();
    console.log(`Using CLI cluster ID: ${cliArgs.clusterId}`);
  }
  if (cliArgs.shard !== undefined) {
    process.env.WAKU_SHARD = cliArgs.shard.toString();
    console.log(`Using CLI shard: ${cliArgs.shard}`);
  }
  if (cliArgs.lightpushNode !== undefined) {
    process.env.WAKU_LIGHTPUSH_NODE = cliArgs.lightpushNode;
    console.log(`Using CLI lightpushnode: ${cliArgs.lightpushNode}`);
  }

  void startServer(port);
}
