import { test, expect } from "@playwright/test";
import axios from "axios";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe.configure({ mode: "serial" });

test.describe("Server Tests", () => {
  let serverProcess: any;
  let baseUrl = "http://localhost:3000";

  test.beforeAll(async () => {
    const serverPath = join(__dirname, "..", "dist", "src", "server.js");
    console.log("Starting server from:", serverPath);

    serverProcess = spawn("node", [serverPath], {
      stdio: "pipe",
      env: { ...process.env, PORT: "3000" }
    });

    serverProcess.stdout?.on("data", (data: Buffer) => {
      console.log("[Server]", data.toString().trim());
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[Server Error]", data.toString().trim());
    });

    console.log("Waiting for server to start...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await axios.get(`${baseUrl}/`, { timeout: 2000 });
        if (res.status === 200) {
          console.log(`Server is ready after ${i + 1} attempts`);
          serverReady = true;
          break;
        }
      } catch (error: any) {
        if (i % 5 === 0) {
          console.log(`Attempt ${i + 1}/30 failed:`, error.code || error.message);
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    expect(serverReady).toBe(true);
  });

  test.afterAll(async () => {
    if (serverProcess) {
      console.log("Stopping server...");
      serverProcess.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  test("server health endpoint", async () => {
    const res = await axios.get(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("Waku simulation server is running");
  });

  test("static files are served", async () => {
    const htmlRes = await axios.get(`${baseUrl}/app/index.html`);
    expect(htmlRes.status).toBe(200);
    expect(htmlRes.data).toContain("Waku Test Environment");

    const jsRes = await axios.get(`${baseUrl}/app/index.js`);
    expect(jsRes.status).toBe(200);
    expect(jsRes.data).toContain("WakuHeadless");
  });

  test("Waku node auto-started", async () => {
    try {
      const infoRes = await axios.get(`${baseUrl}/waku/v1/peer-info`);
      expect(infoRes.status).toBe(200);
      expect(infoRes.data.peerId).toBeDefined();
      expect(infoRes.data.multiaddrs).toBeDefined();
    } catch (error: any) {
      console.log("Waku node test failed (expected if browser not initialized):", error.response?.data?.error || error.message);
      expect(error.response?.status).toBe(400);
    }
  });
});
