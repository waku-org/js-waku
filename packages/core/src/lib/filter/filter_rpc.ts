import { protoFilterV2 as proto, WakuMessage } from "@waku/proto";
import { v4 as uuid } from "uuid";

/**
 * FilterPushRPC represents a message conforming to the Waku FilterPush protocol.
 * Protocol documentation: https://rfc.vac.dev/spec/12/
 */
export class FilterPushRpc {
  public constructor(public proto: proto.MessagePush) {}

  static decode(bytes: Uint8Array): FilterPushRpc {
    const res = proto.MessagePush.decode(bytes);
    return new FilterPushRpc(res);
  }

  encode(): Uint8Array {
    return proto.MessagePush.encode(this.proto);
  }

  get wakuMessage(): WakuMessage | undefined {
    return this.proto.wakuMessage;
  }

  /**
   * Get the pubsub topic from the FilterPushRpc object.
   * @returns string
   */
  get pubsubTopic(): string | undefined {
    return this.proto.pubsubTopic;
  }
}

export class FilterSubscribeRpc {
  public constructor(public proto: proto.FilterSubscribeRequest) {}

  static createSubscribeRequest(
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

  static createUnsubscribeRequest(
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

  static createUnsubscribeAllRequest(pubsubTopic: string): FilterSubscribeRpc {
    return new FilterSubscribeRpc({
      requestId: uuid(),
      filterSubscribeType:
        proto.FilterSubscribeRequest.FilterSubscribeType.UNSUBSCRIBE_ALL,
      pubsubTopic,
      contentTopics: []
    });
  }

  static createSubscriberPingRequest(): FilterSubscribeRpc {
    return new FilterSubscribeRpc({
      requestId: uuid(),
      filterSubscribeType:
        proto.FilterSubscribeRequest.FilterSubscribeType.SUBSCRIBER_PING,
      pubsubTopic: "",
      contentTopics: []
    });
  }

  static decode(bytes: Uint8Array): FilterSubscribeRpc {
    const res = proto.FilterSubscribeRequest.decode(bytes);
    return new FilterSubscribeRpc(res);
  }

  encode(): Uint8Array {
    return proto.FilterSubscribeRequest.encode(this.proto);
  }

  get filterSubscribeType(): proto.FilterSubscribeRequest.FilterSubscribeType {
    return this.proto.filterSubscribeType;
  }

  get requestId(): string {
    return this.proto.requestId;
  }

  get pubsubTopic(): string | undefined {
    return this.proto.pubsubTopic;
  }

  get contentTopics(): string[] {
    return this.proto.contentTopics;
  }
}

export class FilterSubscribeResponse {
  public constructor(public proto: proto.FilterSubscribeResponse) {}

  static decode(bytes: Uint8Array): FilterSubscribeResponse {
    const res = proto.FilterSubscribeResponse.decode(bytes);
    return new FilterSubscribeResponse(res);
  }

  encode(): Uint8Array {
    return proto.FilterSubscribeResponse.encode(this.proto);
  }

  get statusCode(): number {
    return this.proto.statusCode;
  }

  get statusDesc(): string | undefined {
    return this.proto.statusDesc;
  }

  get requestId(): string {
    return this.proto.requestId;
  }
}
