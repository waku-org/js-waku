// For dynamic import of dotenv-flow
import { defineConfig, devices } from "@playwright/test";

// Only load dotenv-flow in non-CI environments
if (!process.env.CI) {
  // Need to use .js extension for ES modules
  // eslint-disable-next-line import/extensions
  await import("dotenv-flow/config.js");
}

const EXAMPLE_PORT = process.env.EXAMPLE_PORT || "8080";
// web-chat specific thingy
const EXAMPLE_TEMPLATE = process.env.EXAMPLE_TEMPLATE || "";
const BASE_URL = `http://127.0.0.1:${EXAMPLE_PORT}/${EXAMPLE_TEMPLATE}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry"
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]

  // No webServer needed; tests manage server processes directly
});
