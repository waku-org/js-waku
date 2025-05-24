import { Browser, chromium, Page } from "@playwright/test";

// Global variable to store the browser and page
let browser: Browser | undefined;
let page: Page | undefined;

/**
 * Initialize browser and load headless page
 */
export async function initBrowser(): Promise<void> {
  browser = await chromium.launch({
    headless: true
  });

  if (!browser) {
    throw new Error("Failed to initialize browser");
  }

  page = await browser.newPage();

  await page.goto("http://localhost:8080");
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
