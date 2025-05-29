import express, { Request, Response, Router } from "express";

import { getPage } from "../browser/index.js";

const router = Router();

// Legacy push message endpoint
router.post("/push", (async (req: Request, res: Response) => {
  try {
    const { contentTopic, payload } = req.body;

    if (!contentTopic) {
      return res.status(400).json({
        code: 400,
        message: "Invalid request. contentTopic is required."
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
      ({ topic, data }) => {
        return window.wakuAPI.pushMessage(window.waku, topic, data);
      },
      {
        topic: contentTopic,
        data: payload
      }
    );

    if (result) {
      res.status(200).json({
        messageId:
          "0x" +
          Buffer.from(contentTopic + Date.now().toString()).toString("hex")
      });
    } else {
      res.status(503).json({
        code: 503,
        message: "Could not publish message: no suitable peers"
      });
    }
  } catch (error: any) {
    if (
      error.message.includes("size exceeds") ||
      error.message.includes("stream reset")
    ) {
      res.status(503).json({
        code: 503,
        message:
          "Could not publish message: message size exceeds gossipsub max message size"
      });
    } else {
      res.status(500).json({
        code: 500,
        message: `Could not publish message: ${error.message}`
      });
    }
  }
}) as express.RequestHandler);

// Waku REST API compatible push endpoint
router.post("/lightpush/v1/message", (async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || !message.contentTopic) {
      return res.status(400).json({
        code: 400,
        message: "Invalid request. contentTopic is required."
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
      ({ contentTopic, payload }) => {
        return window.wakuAPI.pushMessage(window.waku, contentTopic, payload);
      },
      {
        contentTopic: message.contentTopic,
        payload: message.payload
      }
    );

    if (result) {
      res.status(200).json({
        messageId:
          "0x" +
          Buffer.from(message.contentTopic + Date.now().toString()).toString(
            "hex"
          )
      });
    } else {
      res.status(503).json({
        code: 503,
        message: "Could not publish message: no suitable peers"
      });
    }
  } catch (error: any) {
    if (
      error.message.includes("size exceeds") ||
      error.message.includes("stream reset")
    ) {
      res.status(503).json({
        code: 503,
        message:
          "Could not publish message: message size exceeds gossipsub max message size"
      });
    } else {
      res.status(500).json({
        code: 500,
        message: `Could not publish message: ${error.message}`
      });
    }
  }
}) as express.RequestHandler);

export default router;
