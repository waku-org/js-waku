import { Request, Response } from "express";
import { Logger } from "@waku/utils";
import { getPage } from "../browser/index.js";
import type { ITestBrowser } from "../../types/global.js";

const log = new Logger("endpoint-handler");

export interface LightpushV3Request {
  pubsubTopic: string;
  message: {
    payload: string;
    contentTopic: string;
    version: number;
  };
}

export interface LightpushV3Response {
  success?: boolean;
  error?: string;
  result?: {
    successes: string[];
    failures: Array<{
      error: string;
      peerId?: string;
    }>;
  };
}

export interface EndpointConfig<TInput = any, TOutput = any> {
  methodName: string;
  validateInput?: (_requestBody: any) => TInput;
  transformResult?: (_sdkResult: any) => TOutput;
  handleError?: (_caughtError: Error) => { code: number; message: string };
  preCheck?: () => Promise<void> | void;
  logResult?: boolean;
}

export function createEndpointHandler<TInput = any, TOutput = any>(
  config: EndpointConfig<TInput, TOutput>,
) {
  return async (req: Request, res: Response) => {
    try {
      let input: TInput;
      try {
        input = config.validateInput
          ? config.validateInput(req.body)
          : req.body;
      } catch (validationError: any) {
        return res.status(400).json({
          code: 400,
          message: `Invalid input: ${validationError.message}`,
        });
      }

      if (config.preCheck) {
        try {
          await config.preCheck();
        } catch (checkError: any) {
          return res.status(503).json({
            code: 503,
            message: checkError.message,
          });
        }
      }

      const page = getPage();
      if (!page) {
        return res.status(503).json({
          code: 503,
          message: "Browser not initialized",
        });
      }

      const result = await page.evaluate(
        ({ methodName, params }) => {
          const testWindow = window as ITestBrowser;
          if (!testWindow.wakuApi) {
            throw new Error("window.wakuApi is not available");
          }

          const wakuApi = testWindow.wakuApi as unknown as Record<string, unknown>;
          const method = wakuApi[methodName];
          if (typeof method !== "function") {
            throw new Error(`window.wakuApi.${methodName} is not a function`);
          }

          if (params === null || params === undefined) {
            return method.call(testWindow.wakuApi);
          } else if (Array.isArray(params)) {
            return method.apply(testWindow.wakuApi, params);
          } else {
            return method.call(testWindow.wakuApi, params);
          }
        },
        { methodName: config.methodName, params: input },
      );

      if (config.logResult !== false) {
        log.info(
          `[${config.methodName}] Result:`,
          JSON.stringify(result, null, 2),
        );
      }

      const finalResult = config.transformResult
        ? config.transformResult(result)
        : result;

      res.status(200).json(finalResult);
    } catch (error: any) {
      if (config.handleError) {
        const errorResponse = config.handleError(error);
        return res.status(errorResponse.code).json({
          code: errorResponse.code,
          message: errorResponse.message,
        });
      }

      log.error(`[${config.methodName}] Error:`, error);
      res.status(500).json({
        code: 500,
        message: `Could not execute ${config.methodName}: ${error.message}`,
      });
    }
  };
}

export const validators = {
  requireLightpushV3: (body: any): LightpushV3Request => {
    if (
      body.pubsubTopic !== undefined &&
      typeof body.pubsubTopic !== "string"
    ) {
      throw new Error("pubsubTopic must be a string if provided");
    }
    if (!body.message || typeof body.message !== "object") {
      throw new Error("message is required and must be an object");
    }
    if (
      !body.message.contentTopic ||
      typeof body.message.contentTopic !== "string"
    ) {
      throw new Error("message.contentTopic is required and must be a string");
    }
    if (!body.message.payload || typeof body.message.payload !== "string") {
      throw new Error(
        "message.payload is required and must be a string (base64 encoded)",
      );
    }
    if (
      body.message.version !== undefined &&
      typeof body.message.version !== "number"
    ) {
      throw new Error("message.version must be a number if provided");
    }

    return {
      pubsubTopic: body.pubsubTopic || "",
      message: {
        payload: body.message.payload,
        contentTopic: body.message.contentTopic,
        version: body.message.version || 1,
      },
    };
  },

  noInput: () => null,
};

export const errorHandlers = {
  lightpushError: (error: Error) => {
    if (
      error.message.includes("size exceeds") ||
      error.message.includes("stream reset")
    ) {
      return {
        code: 503,
        message:
          "Could not publish message: message size exceeds gossipsub max message size",
      };
    }
    return {
      code: 500,
      message: `Could not publish message: ${error.message}`,
    };
  },
};
