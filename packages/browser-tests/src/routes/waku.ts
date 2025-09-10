import { Router } from "express";
import {
  createEndpointHandler,
  validators,
  errorHandlers,
} from "../utils/endpoint-handler.js";

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
    validateInput: (body) => [
      body.timeoutMs || 10000,
      body.protocols || ["lightpush", "filter"],
    ],
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
    validateInput: (body: any): [string, string, string] => {
      const validatedRequest = validators.requireLightpushV3(body);

      return [
        validatedRequest.message.contentTopic,
        validatedRequest.message.payload,
        validatedRequest.pubsubTopic,
      ];
    },
    handleError: errorHandlers.lightpushError,
    transformResult: (result) => {
      if (result && result.successes && result.successes.length > 0) {
        console.log("[Server] Message successfully sent via v3 lightpush!");

        const sentTime = Date.now() * 1000000;
        const msgHash = result.messageHash;

        const myPeerId = result.myPeerId || 'unknown';
        result.successes.forEach((peerId: string) => {
          console.log(`publishWithConn my_peer_id=${myPeerId} peer_id=${peerId} msg_hash=${msgHash} sentTime=${sentTime}`);
        });

        return {
          success: true,
          result,
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
