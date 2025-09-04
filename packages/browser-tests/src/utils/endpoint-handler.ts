import { Request, Response } from "express";
import { getPage } from "../browser/index.js";

/**
 * nwaku v3 Lightpush API interfaces
 */
export interface LightpushV3Request {
  pubsubTopic: string;
  message: {
    payload: string;      // base64 encoded
    contentTopic: string;
    version: number;
  };
}

export interface LightpushV3Response {
  success?: boolean;
  error?: string;
  result?: {
    successes: string[]; // PeerIds converted to strings
    failures: Array<{
      error: string;
      peerId?: string;
    }>;
    [key: string]: any;
  };
}

/**
 * Configuration for an endpoint handler
 */
/* eslint-disable no-unused-vars */
export interface EndpointConfig<TInput = any, TOutput = any> {
  /** Name of the method to call on window.wakuApi */
  methodName: string;
  /** Optional input validation function - takes request body, returns validated input */
  validateInput?: (requestBody: any) => TInput;
  /** Optional transformation of the result before sending response - takes SDK result, returns transformed result */
  transformResult?: (sdkResult: any) => TOutput;
  /** Optional custom error handling - takes error, returns response with code and message */
  handleError?: (caughtError: Error) => { code: number; message: string };
  /** Optional pre-execution checks */
  preCheck?: () => Promise<void> | void;
  /** Whether to log the result (default: true) */
  logResult?: boolean;
}
/* eslint-enable no-unused-vars */

/**
 * Generic endpoint handler that follows the pattern:
 * 1. Parse and validate inputs
 * 2. Call function on WakuHeadless instance via page.evaluate
 * 3. Wait for result
 * 4. Log result
 * 5. Return result or error
 */
export function createEndpointHandler<TInput = any, TOutput = any>(
  config: EndpointConfig<TInput, TOutput>
) {
  return async (req: Request, res: Response) => {
    try {
      // Step 1: Parse and validate inputs
      let input: TInput;
      try {
        input = config.validateInput ? config.validateInput(req.body) : req.body;
      } catch (validationError: any) {
        return res.status(400).json({
          code: 400,
          message: `Invalid input: ${validationError.message}`
        });
      }

      // Pre-execution checks
      if (config.preCheck) {
        try {
          await config.preCheck();
        } catch (checkError: any) {
          return res.status(503).json({
            code: 503,
            message: checkError.message
          });
        }
      }

      // Check browser availability
      const page = getPage();
      if (!page) {
        return res.status(503).json({
          code: 503,
          message: "Browser not initialized"
        });
      }

      // Step 2 & 3: Call function and wait for result
      const result = await page.evaluate(
        ({ methodName, params }) => {
          if (!window.wakuApi) {
            throw new Error("window.wakuApi is not available");
          }

          const method = (window.wakuApi as any)[methodName];
          if (typeof method !== "function") {
            throw new Error(`window.wakuApi.${methodName} is not a function`);
          }

          // Handle both parameterized and parameterless methods
          if (params === null || params === undefined) {
            return method.call(window.wakuApi);
          } else if (Array.isArray(params)) {
            return method.apply(window.wakuApi, params);
          } else {
            return method.call(window.wakuApi, params);
          }
        },
        { methodName: config.methodName, params: input }
      );

      // Step 4: Log result
      if (config.logResult !== false) {
        console.log(`[${config.methodName}] Result:`, JSON.stringify(result, null, 2));
      }

      // Step 5: Transform and return result
      const finalResult = config.transformResult ? config.transformResult(result) : result;

      res.status(200).json(finalResult);
    } catch (error: any) {
      // Custom error handling
      if (config.handleError) {
        const errorResponse = config.handleError(error);
        return res.status(errorResponse.code).json({
          code: errorResponse.code,
          message: errorResponse.message
        });
      }

      // Default error handling
      console.error(`[${config.methodName}] Error:`, error);
      res.status(500).json({
        code: 500,
        message: `Could not execute ${config.methodName}: ${error.message}`
      });
    }
  };
}

/**
 * Common validation functions
 */
export const validators = {
  requireLightpushV3: (body: any): LightpushV3Request => {
    if (!body.pubsubTopic || typeof body.pubsubTopic !== "string") {
      throw new Error("pubsubTopic is required and must be a string");
    }
    if (!body.message || typeof body.message !== "object") {
      throw new Error("message is required and must be an object");
    }
    if (!body.message.contentTopic || typeof body.message.contentTopic !== "string") {
      throw new Error("message.contentTopic is required and must be a string");
    }
    if (!body.message.payload || typeof body.message.payload !== "string") {
      throw new Error("message.payload is required and must be a string (base64 encoded)");
    }
    if (body.message.version !== undefined && typeof body.message.version !== "number") {
      throw new Error("message.version must be a number if provided");
    }

    return {
      pubsubTopic: body.pubsubTopic,
      message: {
        payload: body.message.payload,
        contentTopic: body.message.contentTopic,
        version: body.message.version || 1
      }
    };
  },

  requirePeerAddrs: (body: any) => {
    if (!Array.isArray(body.peerAddrs)) {
      throw new Error("peerAddrs must be an array");
    }
    return body.peerAddrs;
  },

  noInput: () => null,

  passThrough: (body: any) => body
};

/**
 * Common error handlers
 */
export const errorHandlers = {
  lightpushError: (error: Error) => {
    if (error.message.includes("size exceeds") || error.message.includes("stream reset")) {
      return {
        code: 503,
        message: "Could not publish message: message size exceeds gossipsub max message size"
      };
    }
    return {
      code: 500,
      message: `Could not publish message: ${error.message}`
    };
  }
};
