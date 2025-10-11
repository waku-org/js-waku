import type { Server } from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let server: Server | null = null;

export async function startTestServer(port: number = 8080): Promise<number> {
  const app = express();
  const webDir = join(__dirname, "..", "dist", "web");

  app.use(express.static(webDir));

  return new Promise((resolve, reject) => {
    server = app
      .listen(port, () => {
        resolve(port);
      })
      .on("error", (error: NodeJS.ErrnoException) => {
        reject(error);
      });
  });
}

export async function stopTestServer(): Promise<void> {
  if (server) {
    return new Promise((resolve) => {
      server!.close(() => {
        server = null;
        resolve();
      });
    });
  }
}
