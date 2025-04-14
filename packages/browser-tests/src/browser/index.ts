/* eslint-disable no-console */
import { Browser, chromium, Page } from "@playwright/test";

// Global variable to store the browser and page
let browser: Browser | undefined;
let page: Page | undefined;

/**
 * Initialize browser and load headless page
 */
export async function initBrowser(): Promise<void> {
  try {
    console.log("Initializing browser...");
    browser = await chromium.launch({
      headless: true
    });

    if (!browser) {
      throw new Error("Failed to initialize browser");
    }

    console.log("Creating new page...");
    page = await browser.newPage();

    // Navigate to the headless app
    console.log("Navigating to headless app...");
    await page.goto("http://localhost:8080");

    console.log("Browser initialized successfully!");
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
 * Closes the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = undefined;
    page = undefined;
  }
}
