import { Browser, chromium, Page } from "@playwright/test";

// Global variable to store the browser and page
let browser: Browser | undefined;
let page: Page | undefined;

/**
 * Initialize browser and load the Waku web app
 */
export async function initBrowser(appPort: number): Promise<void> {
  try {
    // Support sandbox-less mode for containers
    const launchArgs =
      process.env.CHROMIUM_NO_SANDBOX === "1"
        ? ["--no-sandbox", "--disable-setuid-sandbox"]
        : [];

    browser = await chromium.launch({
      headless: true,
      args: launchArgs
    });

    if (!browser) {
      throw new Error("Failed to initialize browser");
    }

    page = await browser.newPage();

    // Load the Waku web app
    await page.goto(`http://localhost:${appPort}/app/index.html`, {
      waitUntil: "networkidle",
    });

    // Wait for wakuApi to be available
    await page.waitForFunction(
      () => {
        return window.wakuApi && typeof window.wakuApi.createWakuNode === "function";
      },
      { timeout: 30000 }
    );

    console.log("Browser initialized successfully with wakuApi");
  } catch (error) {
    console.error("Error initializing browser:", error);
    throw error;
  }
}

/**
 * Get the current page instance
 */
export function getPage(): Page | undefined {
  return page;
}

/**
 * Set the page instance (for use by server.ts)
 */
export function setPage(pageInstance: Page | undefined): void {
  page = pageInstance;
}

/**
 * Closes the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = undefined;
    page = undefined;
  }
}
