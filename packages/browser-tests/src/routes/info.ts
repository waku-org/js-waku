import express, { Request, Response, Router } from "express";

import { getPage } from "../browser/index.js";

const router = Router();

// Get node info endpoint
router.get("/info", (async (_req: Request, res: Response) => {
  try {
    const page = getPage();
    if (!page) {
      return res.status(503).json({
        code: 503,
        message: "Browser not initialized"
      });
    }

    const result = await page.evaluate(() => {
      return (window as any).wakuAPI.getPeerInfo((window as any).waku);
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error getting info:", error);
    res.status(500).json({ error: error.message });
  }
}) as express.RequestHandler);

// Get node debug info endpoint
router.get("/debug/v1/info", (async (_req: Request, res: Response) => {
  try {
    const page = getPage();
    if (!page) {
      return res.status(503).json({
        code: 503,
        message: "Browser not initialized"
      });
    }

    const result = await page.evaluate(() => {
      return (window as any).wakuAPI.getDebugInfo((window as any).waku);
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error getting debug info:", error);
    res.status(500).json({ error: error.message });
  }
}) as express.RequestHandler);

export default router;
