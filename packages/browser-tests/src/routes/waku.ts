import { Router } from "express";
import { Logger } from "@waku/utils";
import {
  createEndpointHandler,
  validators,
  errorHandlers,
} from "../utils/endpoint-handler.js";

interface LightPushResult {
  successes: string[];
  failures: Array<{ error: string; peerId?: string }>;
}

const log = new Logger("routes:waku");
const router = Router();

const corsEndpoints = [
  "/waku/v1/wait-for-peers",
  "/waku/v1/peer-info",
  "/lightpush/v3/message",
];

corsEndpoints.forEach((endpoint) => {
  router.head(endpoint, (_req, res) => {
    res.status(200).end();
  });
});

router.post(
  "/waku/v1/wait-for-peers",
  createEndpointHandler({
    methodName: "waitForPeers",
    validateInput: (body: unknown) => {
      const bodyObj = body as { timeoutMs?: number; protocols?: string[] };
      return [
        bodyObj.timeoutMs || 10000,
        bodyObj.protocols || ["lightpush", "filter"],
      ];
    },
    transformResult: () => ({
      success: true,
      message: "Successfully connected to peers",
    }),
  }),
);

router.get(
  "/waku/v1/peer-info",
  createEndpointHandler({
    methodName: "getPeerInfo",
    validateInput: validators.noInput,
  }),
);

router.post(
  "/lightpush/v3/message",
  createEndpointHandler({
    methodName: "pushMessageV3",
    validateInput: (body: unknown): [string, string, string] => {
      const validatedRequest = validators.requireLightpushV3(body);

      return [
        validatedRequest.message.contentTopic,
        validatedRequest.message.payload,
        validatedRequest.pubsubTopic,
      ];
    },
    handleError: errorHandlers.lightpushError,
    transformResult: (result: unknown) => {
      const lightPushResult = result as LightPushResult;
      if (lightPushResult && lightPushResult.successes && lightPushResult.successes.length > 0) {
        log.info("[Server] Message successfully sent via v3 lightpush!");
        return {
          success: true,
          result: lightPushResult,
        };
      } else {
        return {
          success: false,
          error: "Could not publish message: no suitable peers",
        };
      }
    },
  }),
);

export default router;
