import { fileURLToPath } from "url";
import * as path from "path";

import cors from "cors";
import express, { Request, Response } from "express";
import { Logger } from "@waku/utils";

import wakuRouter from "./routes/waku.js";
import { initBrowser, getPage, closeBrowser } from "./browser/index.js";
import {
  DEFAULT_CLUSTER_ID,
  DEFAULT_NUM_SHARDS,
  Protocols,
} from "@waku/interfaces";

const log = new Logger("server");
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
      log.info("Using static shard:", networkConfig.shards);
    }

    const lightpushNode = process.env.WAKU_LIGHTPUSH_NODE || null;
    const enrBootstrap = process.env.WAKU_ENR_BOOTSTRAP || null;

    log.info("Network config on server start, pre headless:", networkConfig);

    const configScript = `    <script>
      window.__WAKU_NETWORK_CONFIG = ${JSON.stringify(networkConfig)};
      window.__WAKU_LIGHTPUSH_NODE = ${JSON.stringify(lightpushNode)};
      window.__WAKU_ENR_BOOTSTRAP = ${JSON.stringify(enrBootstrap)};
    </script>`;
    const originalPattern =
      '    <script type="module" src="./index.js"></script>';
    const replacement = `${configScript}\n    <script type="module" src="./index.js"></script>`;

    htmlContent = htmlContent.replace(originalPattern, replacement);

    res.setHeader("Content-Type", "text/html");
    res.send(htmlContent);
  } catch (error) {
    log.error("Error serving dynamic index.html:", error);
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
        log.info(`API server running on http://localhost:${requestedPort}`);
      })
      .on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          log.error(
            `Port ${requestedPort} is already in use. Please close the application using this port and try again.`,
          );
        } else {
          log.error("Error starting server:", error);
        }
        throw error;
      });

    return requestedPort;
  } catch (error: any) {
    log.error("Error starting server:", error);
    throw error;
  }
}

async function startServer(port: number = 3000): Promise<void> {
  try {
    const actualPort = await startAPI(port);
    await initBrowser(actualPort);

    try {
      log.info("Auto-starting node with CLI configuration...");

      const hasEnrBootstrap = Boolean(process.env.WAKU_ENR_BOOTSTRAP);
      const networkConfig: any = {
        defaultBootstrap: false,
        ...(hasEnrBootstrap && {
          discovery: {
            dns: true,
            peerExchange: true,
            peerCache: true,
          },
        }),
      };

      log.info(
        `Bootstrap mode: ${hasEnrBootstrap ? "ENR-only (defaultBootstrap=false)" : "default bootstrap (defaultBootstrap=true)"}`,
      );
      if (hasEnrBootstrap) {
        log.info(`ENR bootstrap peers: ${process.env.WAKU_ENR_BOOTSTRAP}`);
      }

      networkConfig.networkConfig = {
        clusterId: process.env.WAKU_CLUSTER_ID
          ? parseInt(process.env.WAKU_CLUSTER_ID, 10)
          : DEFAULT_CLUSTER_ID,
        numShardsInCluster: DEFAULT_NUM_SHARDS,
      };

      if (process.env.WAKU_SHARD) {
        networkConfig.networkConfig.shards = [
          parseInt(process.env.WAKU_SHARD, 10),
        ];
        delete networkConfig.networkConfig.numShardsInCluster;
      }

      log.info(
        `Network config: ${JSON.stringify(networkConfig.networkConfig)}`,
      );

      await getPage()?.evaluate((config) => {
        return window.wakuApi.createWakuNode(config);
      }, networkConfig);
      await getPage()?.evaluate(() => window.wakuApi.startNode());

      try {
        await getPage()?.evaluate(() =>
          window.wakuApi.waitForPeers?.(5000, [Protocols.LightPush]),
        );
        log.info("Auto-start completed with bootstrap peers");
      } catch (peerError) {
        log.info(
          "Auto-start completed (no bootstrap peers found - may be expected with test ENRs)",
        );
      }
    } catch (e) {
      log.warn("Auto-start failed:", e);
    }
  } catch (error: any) {
    log.error("Error starting server:", error);
  }
}

process.on("uncaughtException", (error) => {
  log.error("Uncaught Exception:", error);
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  log.error("Unhandled Rejection at:", promise, "reason:", reason);
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

const gracefulShutdown = async (signal: string) => {
  log.info(`Received ${signal}, gracefully shutting down...`);
  try {
    await closeBrowser();
  } catch (e) {
    log.warn("Error closing browser:", e);
  }
  process.exit(0);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

function parseCliArgs() {
  const args = process.argv.slice(2);
  let clusterId: number | undefined;
  let shard: number | undefined;

  for (const arg of args) {
    if (arg.startsWith("--cluster-id=")) {
      clusterId = parseInt(arg.split("=")[1], 10);
      if (isNaN(clusterId)) {
        log.error("Invalid cluster-id value. Must be a number.");
        process.exit(1);
      }
    } else if (arg.startsWith("--shard=")) {
      shard = parseInt(arg.split("=")[1], 10);
      if (isNaN(shard)) {
        log.error("Invalid shard value. Must be a number.");
        process.exit(1);
      }
    }
  }

  return { clusterId, shard };
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const cliArgs = parseCliArgs();

  if (cliArgs.clusterId !== undefined) {
    process.env.WAKU_CLUSTER_ID = cliArgs.clusterId.toString();
    log.info(`Using CLI cluster ID: ${cliArgs.clusterId}`);
  }
  if (cliArgs.shard !== undefined) {
    process.env.WAKU_SHARD = cliArgs.shard.toString();
    log.info(`Using CLI shard: ${cliArgs.shard}`);
  }

  void startServer(port);
}
