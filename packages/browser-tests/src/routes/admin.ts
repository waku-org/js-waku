import express, { Request, Response, Router } from "express";

import { getPage } from "../browser/index.js";

const router = Router();

router.head("/admin/v1/create-node", (_req: Request, res: Response) => {
  res.status(200).end();
});

router.head("/admin/v1/start-node", (_req: Request, res: Response) => {
  res.status(200).end();
});

router.head("/admin/v1/stop-node", (_req: Request, res: Response) => {
  res.status(200).end();
});

router.post("/admin/v1/create-node", (async (req: Request, res: Response) => {
  try {
    const {
      defaultBootstrap = true,
      networkConfig
    } = req.body;

    // Validate that networkConfig is provided
    if (!networkConfig) {
      return res.status(400).json({
        code: 400,
        message: "networkConfig is required"
      });
    }

    // Validate that networkConfig has required properties
    if (networkConfig.clusterId === undefined) {
      return res.status(400).json({
        code: 400,
        message: "networkConfig.clusterId is required"
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
      ({ defaultBootstrap, networkConfig }) => {
        const nodeOptions: any = {
          defaultBootstrap,
          relay: {
            advertise: true,
            gossipsubOptions: {
              allowPublishToZeroPeers: true
            }
          },
          filter: true,
          peers: [],
          networkConfig: {
            clusterId: networkConfig.clusterId,
            shards: networkConfig.shards || [0]
          }
        };

        return window.wakuAPI.createWakuNode(nodeOptions);
      },
      { defaultBootstrap, networkConfig }
    );

    if (result && result.success) {
      res.status(200).json({
        success: true,
        message: "Waku node created successfully"
      });
    } else {
      res.status(500).json({
        code: 500,
        message: "Failed to create Waku node",
        details: result?.error || "Unknown error"
      });
    }
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: `Could not create Waku node: ${error.message}`
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

    if (result && !result.error) {
      res.status(200).json({
        success: true,
        message: "Waku node started successfully"
      });
    } else {
      res.status(500).json({
        code: 500,
        message: "Failed to start Waku node",
        details: result?.error || "Unknown error"
      });
    }
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: `Could not start Waku node: ${error.message}`
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

    if (result && !result.error) {
      res.status(200).json({
        success: true,
        message: "Waku node stopped successfully"
      });
    } else {
      res.status(500).json({
        code: 500,
        message: "Failed to stop Waku node",
        details: result?.error || "Unknown error"
      });
    }
  } catch (error: any) {
    res.status(500).json({
      code: 500,
      message: `Could not stop Waku node: ${error.message}`
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
          result.errors?.map((error: string, index: number) => {
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
    res.status(500).json({
      code: 500,
      message: `Could not dial peers: ${error.message}`
    });
  }
}) as express.RequestHandler);

export default router;
