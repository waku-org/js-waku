import { defineConfig, devices } from "@playwright/test";
import { Logger } from "@waku/utils";

const log = new Logger("playwright-config");

if (!process.env.CI) {
  try {
    await import("dotenv-flow/config.js");
  } catch (e) {
    log.warn("dotenv-flow not found; skipping env loading");
  }
}

const EXAMPLE_PORT = process.env.EXAMPLE_PORT || "8080";
const BASE_URL = `http://127.0.0.1:${EXAMPLE_PORT}`;
const TEST_IGNORE = process.env.CI ? ["tests/e2e.spec.ts"] : [];

export default defineConfig({
  testDir: "./tests",
  testIgnore: TEST_IGNORE,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,

    trace: "on-first-retry"
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]

});
