/* eslint-disable no-console */
import express, { Request, Response, Router } from "express";

import { getPage } from "../browser/index.js";

const router = Router();

// Create Waku node endpoint
router.post("/admin/v1/create-node", (async (req: Request, res: Response) => {
  try {
    const nodeOptions = req.body;
    const page = getPage();

    if (!page) {
      return res.status(503).json({
        code: 503,
        message: "Browser not initialized"
      });
    }

    const result = await page.evaluate((options) => {
      return window.wakuAPI.createWakuNode(options);
    }, nodeOptions);

    res.json(result);
  } catch (error: any) {
    console.error("Error creating node:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}) as express.RequestHandler);

// Start Waku node endpoint
router.post("/admin/v1/start-node", (async (_req: Request, res: Response) => {
  try {
    const page = getPage();

    if (!page) {
      return res.status(503).json({
        code: 503,
        message: "Browser not initialized"
      });
    }

    const result = await page.evaluate(() => {
      return window.wakuAPI.startNode
        ? window.wakuAPI.startNode()
        : { error: "startNode function not available" };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error starting node:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}) as express.RequestHandler);

// Stop Waku node endpoint
router.post("/admin/v1/stop-node", (async (_req: Request, res: Response) => {
  try {
    const page = getPage();

    if (!page) {
      return res.status(503).json({
        code: 503,
        message: "Browser not initialized"
      });
    }

    const result = await page.evaluate(() => {
      return window.wakuAPI.stopNode
        ? window.wakuAPI.stopNode()
        : { error: "stopNode function not available" };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error stopping node:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}) as express.RequestHandler);

// Dial to peers endpoint
router.post("/admin/v1/peers", (async (req: Request, res: Response) => {
  try {
    const { peerMultiaddrs } = req.body;

    if (!peerMultiaddrs || !Array.isArray(peerMultiaddrs)) {
      return res.status(400).json({
        code: 400,
        message: "Invalid request. peerMultiaddrs array is required."
      });
    }

    const page = getPage();

    if (!page) {
      return res.status(503).json({
        code: 503,
        message: "Browser not initialized"
      });
    }

    const result = await page.evaluate(
      ({ peerAddrs }) => {
        return window.wakuAPI.dialPeers(window.waku, peerAddrs);
      },
      { peerAddrs: peerMultiaddrs }
    );

    if (result) {
      res.status(200).json({
        peersAdded: peerMultiaddrs.length - (result.errors?.length || 0),
        peerErrors:
          result.errors?.map((error, index) => {
            return {
              peerMultiaddr: peerMultiaddrs[index],
              error
            };
          }) || []
      });
    } else {
      res.status(500).json({
        code: 500,
        message: "Failed to dial peers"
      });
    }
  } catch (error: any) {
    console.error("Error dialing peers:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}) as express.RequestHandler);

export default router;
