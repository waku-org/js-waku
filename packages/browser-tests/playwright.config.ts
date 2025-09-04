// For dynamic import of dotenv-flow
import { defineConfig, devices } from "@playwright/test";

// Only load dotenv-flow in non-CI environments
if (!process.env.CI) {
  // Need to use .js extension for ES modules
  // eslint-disable-next-line import/extensions
  try {
    await import("dotenv-flow/config.js");
  } catch (e) {
    console.warn("dotenv-flow not found; skipping env loading");
  }
}

const EXAMPLE_PORT = process.env.EXAMPLE_PORT || "8080";
const BASE_URL = `http://127.0.0.1:${EXAMPLE_PORT}`;
// Ignore docker-based tests on CI
const TEST_IGNORE = process.env.CI ? ["tests/docker-*.spec.ts"] : [];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  testIgnore: TEST_IGNORE,
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

});
