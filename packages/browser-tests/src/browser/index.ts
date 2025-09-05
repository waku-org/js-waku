import { Browser, chromium, Page } from "@playwright/test";

let browser: Browser | undefined;
let page: Page | undefined;

export async function initBrowser(appPort: number): Promise<void> {
  try {
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

    await page.goto(`http://localhost:${appPort}/app/index.html`, {
      waitUntil: "networkidle",
    });

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

export function getPage(): Page | undefined {
  return page;
}

export function setPage(pageInstance: Page | undefined): void {
  page = pageInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = undefined;
    page = undefined;
  }
}
