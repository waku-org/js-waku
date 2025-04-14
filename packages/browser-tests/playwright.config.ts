import "dotenv-flow/config";
import { defineConfig, devices } from "@playwright/test";

const EXAMPLE_PORT = process.env.EXAMPLE_PORT;
// web-chat specific thingy
const EXAMPLE_TEMPLATE = process.env.EXAMPLE_TEMPLATE;
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

    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] }
    // },

    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] }
    // }

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    url: BASE_URL,
    stdout: "pipe",
    stderr: "pipe",
    command: "npm start",
    reuseExistingServer: !process.env.CI,
    timeout: 5 * 60 * 1000 // five minutes for bootstrapping an example
  }
});
