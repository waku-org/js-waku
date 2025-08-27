import { Router } from "express";
import { createEndpointHandler, validators, errorHandlers } from "../utils/endpoint-handler.js";
import { getPage } from "../browser/index.js";

const router = Router();

// CORS preflight handlers
const corsEndpoints = [
  "/waku/v1/create-node",
  "/waku/v1/start-node",
  "/waku/v1/stop-node",
  "/waku/v1/wait-for-peers",
  "/waku/v1/dial-peers",
  "/waku/v1/peer-info",
  "/waku/v1/debug-info",
  "/waku/v1/peer-protocols",
  "/waku/v1/connection-status",
  "/waku/v1/execute",
  "/lightpush/v3/message"
];

corsEndpoints.forEach(endpoint => {
  router.head(endpoint, (_req, res) => {
    res.status(200).end();
  });
});

// Node lifecycle endpoints
router.post("/waku/v1/create-node", createEndpointHandler({
  methodName: "createWakuNode",
  validateInput: validators.requireNetworkConfig,
  transformResult: (result) => ({
    success: result?.success || false,
    message: result?.success ? "Waku node created successfully" : "Failed to create Waku node"
  })
}));

router.post("/waku/v1/start-node", createEndpointHandler({
  methodName: "startNode",
  validateInput: validators.noInput,
  transformResult: (result) => ({
    success: result?.success || false,
    message: result?.success ? "Waku node started successfully" : "Failed to start Waku node"
  })
}));

router.post("/waku/v1/stop-node", createEndpointHandler({
  methodName: "stopNode",
  validateInput: validators.noInput,
  transformResult: (result) => ({
    success: result?.success || false,
    message: result?.success ? "Waku node stopped successfully" : "Failed to stop Waku node"
  })
}));

// Messaging endpoints

// Peer management endpoints
router.post("/waku/v1/wait-for-peers", createEndpointHandler({
  methodName: "waitForPeers",
  validateInput: (body) => [
    body.timeoutMs || 10000,
    body.protocols || ["lightpush", "filter"]
  ],
  transformResult: () => ({
    success: true,
    message: "Successfully connected to peers"
  })
}));

router.post("/waku/v1/dial-peers", createEndpointHandler({
  methodName: "dialPeers",
  validateInput: validators.requirePeerAddrs
}));

// Information endpoints (GET)
router.get("/waku/v1/peer-info", createEndpointHandler({
  methodName: "getPeerInfo",
  validateInput: validators.noInput
}));

router.get("/waku/v1/debug-info", createEndpointHandler({
  methodName: "getDebugInfo",
  validateInput: validators.noInput
}));

router.get("/waku/v1/peer-protocols", createEndpointHandler({
  methodName: "getAvailablePeerProtocols",
  validateInput: validators.noInput
}));

router.get("/waku/v1/connection-status", createEndpointHandler({
  methodName: "getPeerConnectionStatus",
  validateInput: validators.noInput
}));

// nwaku v3 lightpush endpoint
router.post("/lightpush/v3/message", createEndpointHandler({
  methodName: "pushMessageV3",
  validateInput: (body: any): [string, string, string] => {
    const validatedRequest = validators.requireLightpushV3(body);

    // For v3 API, we pass the base64 payload directly to the method
    // The WakuHeadless pushMessageV3 method will handle base64 decoding
    return [
      validatedRequest.message.contentTopic,
      validatedRequest.message.payload,  // Keep as base64
      validatedRequest.pubsubTopic
    ];
  },
  handleError: errorHandlers.lightpushError,
  preCheck: async () => {
    try {
      console.log("[Server] Waiting for Lightpush peers before sending message...");
      await getPage()?.evaluate(() => {
        return window.wakuApi.waitForPeers?.(10000, ["lightpush"] as any);
      });
      console.log("[Server] Found Lightpush peers");
    } catch (e) {
      console.warn("[Server] No Lightpush peers found:", e);
    }
  },
  transformResult: (result) => {
    if (result && result.successes && result.successes.length > 0) {
      console.log("[Server] Message successfully sent via v3 lightpush!");
      return {
        success: true,
        result
      };
    } else {
      return {
        success: false,
        error: "Could not publish message: no suitable peers"
      };
    }
  }
}));


// Custom handler for the execute endpoint since it needs special logic
router.post("/waku/v1/execute", async (req, res) => {
  try {
    const { functionName, params = [] } = req.body;

    if (!functionName || typeof functionName !== "string") {
      return res.status(400).json({
        code: 400,
        message: "functionName is required and must be a string"
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
      ({ fnName, fnParams }) => {
        const api: any = (window as any).wakuApi;
        if (!api || typeof api[fnName] !== "function") {
          return { error: `Function ${fnName} not found` };
        }
        return api[fnName](...fnParams);
      },
      { fnName: functionName, fnParams: params }
    );

    console.log(`[execute:${functionName}] Result:`, JSON.stringify(result, null, 2));
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error executing function", error);
    res.status(500).json({
      code: 500,
      message: `Could not execute function: ${error.message}`
    });
  }
});

export default router;
