import { Router } from "express";
import { createEndpointHandler, validators } from "../utils/endpoint-handler.js";

const router = Router();

// HEAD endpoints for CORS preflight
router.head("/admin/v1/create-node", (_req, res) => {
  res.status(200).end();
});

router.head("/admin/v1/start-node", (_req, res) => {
  res.status(200).end();
});

// Create Waku node endpoint
router.post("/admin/v1/create-node", createEndpointHandler({
  methodName: "createWakuNode",
  validateInput: (body) => {
    if (!body.networkConfig || body.networkConfig.clusterId === undefined) {
      throw new Error("networkConfig.clusterId is required");
    }
    return {
      defaultBootstrap: body.defaultBootstrap ?? true,
      networkConfig: body.networkConfig
    };
  },
  transformResult: (result) => ({
    success: result?.success || false,
    message: result?.success ? "Waku node created successfully" : "Failed to create Waku node"
  })
}));

// Start Waku node endpoint
router.post("/admin/v1/start-node", createEndpointHandler({
  methodName: "startNode",
  validateInput: validators.noInput,
  transformResult: (result) => {
    const success = result && (result.success === undefined || result.success);
    return {
      success,
      message: success ? "Waku node started successfully" : "Failed to start Waku node",
      ...(result?.error && { details: result.error })
    };
  }
}));



export default router;
