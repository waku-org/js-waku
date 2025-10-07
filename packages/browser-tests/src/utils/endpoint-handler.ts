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

export interface EndpointConfig<TInput = unknown, TOutput = unknown> {
  methodName: string;
  validateInput?: (_requestBody: unknown) => TInput;
  transformResult?: (_sdkResult: unknown) => TOutput;
  handleError?: (_caughtError: Error) => { code: number; message: string };
  preCheck?: () => Promise<void> | void;
  logResult?: boolean;
}

export function createEndpointHandler<TInput = unknown, TOutput = unknown>(
  config: EndpointConfig<TInput, TOutput>,
) {
  return async (req: Request, res: Response) => {
    try {
      let input: TInput;
      try {
        input = config.validateInput
          ? config.validateInput(req.body)
          : req.body;
      } catch (validationError) {
        return res.status(400).json({
          code: 400,
          message: `Invalid input: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
        });
      }

      if (config.preCheck) {
        try {
          await config.preCheck();
        } catch (checkError) {
          return res.status(503).json({
            code: 503,
            message: checkError instanceof Error ? checkError.message : String(checkError),
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
    } catch (error) {
      if (config.handleError) {
        const errorResponse = config.handleError(error as Error);
        return res.status(errorResponse.code).json({
          code: errorResponse.code,
          message: errorResponse.message,
        });
      }

      log.error(`[${config.methodName}] Error:`, error);
      res.status(500).json({
        code: 500,
        message: `Could not execute ${config.methodName}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };
}

export const validators = {
  requireLightpushV3: (body: unknown): LightpushV3Request => {
    // Type guard to check if body is an object
    if (!body || typeof body !== "object") {
      throw new Error("Request body must be an object");
    }

    const bodyObj = body as Record<string, unknown>;

    if (
      bodyObj.pubsubTopic !== undefined &&
      typeof bodyObj.pubsubTopic !== "string"
    ) {
      throw new Error("pubsubTopic must be a string if provided");
    }
    if (!bodyObj.message || typeof bodyObj.message !== "object") {
      throw new Error("message is required and must be an object");
    }

    const message = bodyObj.message as Record<string, unknown>;

    if (
      !message.contentTopic ||
      typeof message.contentTopic !== "string"
    ) {
      throw new Error("message.contentTopic is required and must be a string");
    }
    if (!message.payload || typeof message.payload !== "string") {
      throw new Error(
        "message.payload is required and must be a string (base64 encoded)",
      );
    }
    if (
      message.version !== undefined &&
      typeof message.version !== "number"
    ) {
      throw new Error("message.version must be a number if provided");
    }

    return {
      pubsubTopic: (bodyObj.pubsubTopic as string) || "",
      message: {
        payload: message.payload as string,
        contentTopic: message.contentTopic as string,
        version: (message.version as number) || 1,
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
