import { Browser, chromium, Page } from "@playwright/test";
import { Logger } from "@waku/utils";

const log = new Logger("browser");

let browser: Browser | undefined;
let page: Page | undefined;

export async function initBrowser(appPort: number): Promise<void> {
  try {
    const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox"];

    browser = await chromium.launch({
      headless: true,
      args: launchArgs
    });

    if (!browser) {
      throw new Error("Failed to initialize browser");
    }

    page = await browser.newPage();

    // Forward browser console to server logs
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      log.info(`[Browser Console ${type.toUpperCase()}] ${text}`);
    });

    page.on('pageerror', error => {
      log.error('[Browser Page Error]', error.message);
    });

    await page.goto(`http://localhost:${appPort}/app/index.html`, {
      waitUntil: "networkidle",
    });

    await page.waitForFunction(
      () => {
        return window.wakuApi && typeof window.wakuApi.createWakuNode === "function";
      },
      { timeout: 30000 }
    );

    log.info("Browser initialized successfully with wakuApi");
  } catch (error) {
    log.error("Error initializing browser:", error);
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
