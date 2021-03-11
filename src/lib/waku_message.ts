import { WakuMessage } from '../gen/proto/waku/v2/waku_pb';

// Ensure that this class matches the proto interface while
// Protecting the user from protobuf oddities
export class Message {
  public payload: Uint8Array | string;
  public contentTopic: number;
  public version: number;

  private constructor(public protobuf: WakuMessage) {
    this.protobuf = protobuf;

    const msg = protobuf.toObject();

    this.payload = msg.payload;
    this.contentTopic = msg.contentTopic;
    this.version = msg.version;
  }

  static fromString(message: string): Message {
    const wakuMsg = new WakuMessage();

    // Only Version 0 is implemented in Waku 2.
    // 0: payload SHOULD be either unencrypted or that encryption is done at a separate layer outside of Waku.
    wakuMsg.setVersion(0);

    // This is the content topic commonly used at this time
    wakuMsg.setContentTopic(1);

    wakuMsg.setPayload(message);

    return new Message(wakuMsg);
  }

  static fromBinary(message: Uint8Array): Message {
    const wakuMsg = WakuMessage.deserializeBinary(message);
    return new Message(wakuMsg);
  }

  toBinary(): Uint8Array {
    return this.protobuf.serializeBinary();
  }

  // Purely for tests purposes.
  // We do not care about protobuf field when checking equality
  isEqualTo(other: Message) {
    return (
      this.payload === other.payload &&
      this.contentTopic === other.contentTopic &&
      this.version === other.version
    );
  }
}
