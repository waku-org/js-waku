// Ensure that this class matches the proto interface while
import { Reader } from 'protobufjs/minimal';

// Protecting the user from protobuf oddities
import { WakuMessage } from '../proto/waku/v2/waku';

const DEFAULT_CONTENT_TOPIC = 1;
const DEFAULT_VERSION = 0;

export class Message {
  private constructor(
    public payload?: Uint8Array,
    public contentTopic?: number,
    public version?: number
  ) {}

  /**
   * Create Message from utf-8 string
   * @param message
   * @returns {Message}
   */
  static fromUtf8String(message: string): Message {
    const payload = Buffer.from(message, 'utf-8');
    return new Message(payload, DEFAULT_CONTENT_TOPIC, DEFAULT_VERSION);
  }

  static fromBinary(bytes: Uint8Array): Message {
    const wakuMsg = WakuMessage.decode(Reader.create(bytes));
    return new Message(wakuMsg.payload, wakuMsg.contentTopic, wakuMsg.version);
  }

  toBinary(): Uint8Array {
    return WakuMessage.encode({
      payload: this.payload,
      version: this.version,
      contentTopic: this.contentTopic,
    }).finish();
  }

  utf8Payload(): string {
    if (!this.payload) {
      return '';
    }

    return Array.from(this.payload)
      .map((char) => {
        return String.fromCharCode(char);
      })
      .join('');
  }

  // Purely for tests purposes.
  // We do consider protobuf field when checking equality
  // As the content is held by the other fields.
  isEqualTo(other: Message) {
    const payloadsAreEqual =
      this.payload && other.payload
        ? Buffer.compare(this.payload, other.payload) === 0
        : !(this.payload || other.payload);
    return (
      payloadsAreEqual &&
      this.contentTopic === other.contentTopic &&
      this.version === other.version
    );
  }
}
