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
export class PushRpc {
  public constructor(
    public proto: proto.LightPushRequestV3 | proto.LightPushResponseV3
  ) {}

  /**
   * Create a v3 request message with proper field numbering
   */
  public static createRequest(
    message: proto.WakuMessage,
    pubsubTopic: string
  ): PushRpc {
    return new PushRpc({
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
  ): PushRpc {
    return new PushRpc({
      requestId,
      statusCode,
      statusDesc,
      relayPeerCount
    });
  }

  /**
   * Decode v3 request message
   */
  public static decodeRequest(bytes: Uint8ArrayList): PushRpc {
    const res = proto.LightPushRequestV3.decode(bytes);
    return new PushRpc(res);
  }

  /**
   * Decode v3 response message
   */
  public static decodeResponse(bytes: Uint8ArrayList): PushRpc {
    const res = proto.LightPushResponseV3.decode(bytes);
    return new PushRpc(res);
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
