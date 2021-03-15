import { WakuMessage } from '../gen/proto/waku/v2/waku_pb';

// Ensure that this class matches the proto interface while
// Protecting the user from protobuf oddities
export class Message {
  public payload: Uint8Array;
  public contentTopic: number;
  public version: number;

  private constructor(public protobuf: WakuMessage) {
    this.protobuf = protobuf;

    const msg = protobuf.toObject();

    // Let's make is easier to avoid mistakes and only store in Uint8Array format
    let payload;
    if (typeof msg.payload === 'string') {
      payload = Buffer.from(msg.payload, 'base64');
    } else {
      payload = msg.payload;
    }
    this.payload = payload;
    this.contentTopic = msg.contentTopic;
    this.version = msg.version;
  }

  /**
   * Create Message from utf-8 string
   * @param message
   * @returns {Message}
   */
  static fromUtf8String(message: string): Message {
    const wakuMsg = new WakuMessage();

    // Only Version 0 is implemented in Waku 2.
    // 0: payload SHOULD be either plain or that encryption is done at a separate layer outside of Waku.
    wakuMsg.setVersion(0);

    // This is the content topic commonly used at this time
    wakuMsg.setContentTopic(1);

    const buf = Buffer.from(message, 'utf-8');

    // Only accepts Uint8Array or base64 string
    wakuMsg.setPayload(buf);

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
  // We do consider protobuf field when checking equality
  // As the content is held by the other fields.
  isEqualTo(other: Message) {
    return (
      Buffer.compare(this.payload, other.payload) === 0 &&
      this.contentTopic === other.contentTopic &&
      this.version === other.version
    );
  }
}
