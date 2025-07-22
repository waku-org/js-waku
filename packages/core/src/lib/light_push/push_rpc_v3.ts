import { proto_lightpush as proto } from "@waku/proto";
import type { Uint8ArrayList } from "uint8arraylist";
import { v4 as uuid } from "uuid";

/**
 * LightPush v3 protocol RPC handler.
 * Implements the v3 message format with correct field numbers:
 * - requestId: 1
 * - pubsubTopic: 20
 * - message: 21
 */
export class PushRpcV3 {
  public constructor(
    public proto: proto.LightPushRequestV3 | proto.LightPushResponseV3
  ) {}

  /**
   * Create a v3 request message with proper field numbering
   */
  public static createRequest(
    message: proto.WakuMessage,
    pubsubTopic: string
  ): PushRpcV3 {
    return new PushRpcV3({
      requestId: uuid(),
      pubsubTopic: pubsubTopic,
      message: message
    });
  }

  /**
   * Create a v3 response message with status code handling
   */
  public static createResponse(
    requestId: string,
    statusCode: number,
    statusDesc?: string,
    relayPeerCount?: number
  ): PushRpcV3 {
    return new PushRpcV3({
      requestId,
      statusCode,
      statusDesc,
      relayPeerCount
    });
  }

  /**
   * Decode v3 request message
   */
  public static decodeRequest(bytes: Uint8ArrayList): PushRpcV3 {
    const res = proto.LightPushRequestV3.decode(bytes);
    return new PushRpcV3(res);
  }

  /**
   * Decode v3 response message
   */
  public static decodeResponse(bytes: Uint8ArrayList): PushRpcV3 {
    const res = proto.LightPushResponseV3.decode(bytes);
    return new PushRpcV3(res);
  }

  /**
   * Encode message to bytes
   */
  public encode(): Uint8Array {
    if (this.isRequest()) {
      return proto.LightPushRequestV3.encode(
        this.proto as proto.LightPushRequestV3
      );
    } else {
      return proto.LightPushResponseV3.encode(
        this.proto as proto.LightPushResponseV3
      );
    }
  }

  /**
   * Get request data (if this is a request message)
   */
  public get request(): proto.LightPushRequestV3 | undefined {
    return this.isRequest()
      ? (this.proto as proto.LightPushRequestV3)
      : undefined;
  }

  /**
   * Get response data (if this is a response message)
   */
  public get response(): proto.LightPushResponseV3 | undefined {
    return this.isResponse()
      ? (this.proto as proto.LightPushResponseV3)
      : undefined;
  }

  /**
   * Get the request ID
   */
  public get requestId(): string {
    return this.proto.requestId;
  }

  /**
   * Get the pubsub topic (only available in requests)
   */
  public get pubsubTopic(): string | undefined {
    return this.isRequest()
      ? (this.proto as proto.LightPushRequestV3).pubsubTopic
      : undefined;
  }

  /**
   * Get the message (only available in requests)
   */
  public get message(): proto.WakuMessage | undefined {
    return this.isRequest()
      ? (this.proto as proto.LightPushRequestV3).message
      : undefined;
  }

  /**
   * Get the status code (only available in responses)
   */
  public get statusCode(): number | undefined {
    return this.isResponse()
      ? (this.proto as proto.LightPushResponseV3).statusCode
      : undefined;
  }

  /**
   * Get the status description (only available in responses)
   */
  public get statusDesc(): string | undefined {
    return this.isResponse()
      ? (this.proto as proto.LightPushResponseV3).statusDesc
      : undefined;
  }

  /**
   * Get the relay peer count (only available in responses)
   */
  public get relayPeerCount(): number | undefined {
    return this.isResponse()
      ? (this.proto as proto.LightPushResponseV3).relayPeerCount
      : undefined;
  }

  /**
   * Check if this is a request message
   */
  private isRequest(): boolean {
    return "pubsubTopic" in this.proto && "message" in this.proto;
  }

  /**
   * Check if this is a response message
   */
  private isResponse(): boolean {
    return "statusCode" in this.proto;
  }
}

/**
 * Utility functions for v3 status code handling
 */
export class LightPushV3StatusCodes {
  // Success status codes
  public static readonly SUCCESS = 200;

  // Client error status codes (4xx)
  public static readonly BAD_REQUEST = 400;
  public static readonly UNAUTHORIZED = 401;
  public static readonly FORBIDDEN = 403;
  public static readonly NOT_FOUND = 404;
  public static readonly PAYLOAD_TOO_LARGE = 413;
  public static readonly UNSUPPORTED_MEDIA_TYPE = 415;
  public static readonly TOO_MANY_REQUESTS = 429;

  // Server error status codes (5xx)
  public static readonly INTERNAL_SERVER_ERROR = 500;
  public static readonly BAD_GATEWAY = 502;
  public static readonly SERVICE_UNAVAILABLE = 503;
  public static readonly GATEWAY_TIMEOUT = 504;

  /**
   * Check if status code indicates success
   */
  public static isSuccess(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 300;
  }

  /**
   * Check if status code indicates client error
   */
  public static isClientError(statusCode: number): boolean {
    return statusCode >= 400 && statusCode < 500;
  }

  /**
   * Check if status code indicates server error
   */
  public static isServerError(statusCode: number): boolean {
    return statusCode >= 500 && statusCode < 600;
  }

  /**
   * Get human-readable status message for common status codes
   */
  public static getStatusMessage(statusCode: number): string {
    switch (statusCode) {
      case this.SUCCESS:
        return "OK";
      case this.BAD_REQUEST:
        return "Bad Request";
      case this.UNAUTHORIZED:
        return "Unauthorized";
      case this.FORBIDDEN:
        return "Forbidden";
      case this.NOT_FOUND:
        return "Not Found";
      case this.PAYLOAD_TOO_LARGE:
        return "Payload Too Large";
      case this.UNSUPPORTED_MEDIA_TYPE:
        return "Unsupported Media Type";
      case this.TOO_MANY_REQUESTS:
        return "Too Many Requests";
      case this.INTERNAL_SERVER_ERROR:
        return "Internal Server Error";
      case this.BAD_GATEWAY:
        return "Bad Gateway";
      case this.SERVICE_UNAVAILABLE:
        return "Service Unavailable";
      case this.GATEWAY_TIMEOUT:
        return "Gateway Timeout";
      default:
        return `Unknown Status Code: ${statusCode}`;
    }
  }
}
