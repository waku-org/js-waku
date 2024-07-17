import { proto_filter_v2 as proto, WakuMessage } from "@waku/proto";
import { v4 as uuid } from "uuid";

/**
 * FilterPushRPC represents a message conforming to the Waku FilterPush protocol.
 * Protocol documentation: https://rfc.vac.dev/spec/12/
 */
export class FilterPushRpc {
  public constructor(public proto: proto.MessagePush) {}

  public static decode(bytes: Uint8Array): FilterPushRpc {
    const res = proto.MessagePush.decode(bytes);
    return new FilterPushRpc(res);
  }

  public encode(): Uint8Array {
    return proto.MessagePush.encode(this.proto);
  }

  public get wakuMessage(): WakuMessage | undefined {
    return this.proto.wakuMessage;
  }

  /**
   * Get the pubsub topic from the FilterPushRpc object.
   * @returns string
   */
  public get pubsubTopic(): string | undefined {
    return this.proto.pubsubTopic;
  }
}

export class FilterSubscribeRpc {
  public constructor(public proto: proto.FilterSubscribeRequest) {}

  public static createSubscribeRequest(
    pubsubTopic: string,
    contentTopics: string[]
  ): FilterSubscribeRpc {
    return new FilterSubscribeRpc({
      requestId: uuid(),
      filterSubscribeType:
        proto.FilterSubscribeRequest.FilterSubscribeType.SUBSCRIBE,
      pubsubTopic,
      contentTopics
    });
  }

  public static createUnsubscribeRequest(
    pubsubTopic: string,
    contentTopics: string[]
  ): FilterSubscribeRpc {
    return new FilterSubscribeRpc({
      requestId: uuid(),
      filterSubscribeType:
        proto.FilterSubscribeRequest.FilterSubscribeType.UNSUBSCRIBE,
      pubsubTopic,
      contentTopics
    });
  }

  public static createUnsubscribeAllRequest(
    pubsubTopic: string
  ): FilterSubscribeRpc {
    return new FilterSubscribeRpc({
      requestId: uuid(),
      filterSubscribeType:
        proto.FilterSubscribeRequest.FilterSubscribeType.UNSUBSCRIBE_ALL,
      pubsubTopic,
      contentTopics: []
    });
  }

  public static createSubscriberPingRequest(): FilterSubscribeRpc {
    return new FilterSubscribeRpc({
      requestId: uuid(),
      filterSubscribeType:
        proto.FilterSubscribeRequest.FilterSubscribeType.SUBSCRIBER_PING,
      pubsubTopic: "",
      contentTopics: []
    });
  }

  public static decode(bytes: Uint8Array): FilterSubscribeRpc {
    const res = proto.FilterSubscribeRequest.decode(bytes);
    return new FilterSubscribeRpc(res);
  }

  public encode(): Uint8Array {
    return proto.FilterSubscribeRequest.encode(this.proto);
  }

  public get filterSubscribeType(): proto.FilterSubscribeRequest.FilterSubscribeType {
    return this.proto.filterSubscribeType;
  }

  public get requestId(): string {
    return this.proto.requestId;
  }

  public get pubsubTopic(): string | undefined {
    return this.proto.pubsubTopic;
  }

  public get contentTopics(): string[] {
    return this.proto.contentTopics;
  }
}

export class FilterSubscribeResponse {
  public constructor(public proto: proto.FilterSubscribeResponse) {}

  public static decode(bytes: Uint8Array): FilterSubscribeResponse {
    const res = proto.FilterSubscribeResponse.decode(bytes);
    return new FilterSubscribeResponse(res);
  }

  public encode(): Uint8Array {
    return proto.FilterSubscribeResponse.encode(this.proto);
  }

  public get statusCode(): number {
    return this.proto.statusCode;
  }

  public get statusDesc(): string | undefined {
    return this.proto.statusDesc;
  }

  public get requestId(): string {
    return this.proto.requestId;
  }
}
