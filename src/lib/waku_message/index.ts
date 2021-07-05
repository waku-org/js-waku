// Ensure that this class matches the proto interface while
import { Reader } from 'protobufjs/minimal';

// Protecting the user from protobuf oddities
import * as proto from '../../proto/waku/v2/message';

export const DefaultContentTopic = '/waku/2/default-content/proto';
const DefaultVersion = 0;

export class WakuMessage {
  public constructor(public proto: proto.WakuMessage) {}

  /**
   * Create Message with a utf-8 string as payload.
   */
  static fromUtf8String(
    utf8: string,
    contentTopic: string = DefaultContentTopic,
    timestamp: Date = new Date()
  ): WakuMessage {
    const payload = Buffer.from(utf8, 'utf-8');
    return new WakuMessage({
      payload,
      version: DefaultVersion,
      contentTopic,
      timestamp: timestamp.valueOf() / 1000,
    });
  }

  /**
   * Create Message with a byte array as payload.
   */
  static fromBytes(
    payload: Uint8Array,
    contentTopic: string = DefaultContentTopic,
    timestamp: Date = new Date()
  ): WakuMessage {
    return new WakuMessage({
      payload,
      timestamp: timestamp.valueOf() / 1000,
      version: DefaultVersion,
      contentTopic,
    });
  }

  static decode(bytes: Uint8Array): WakuMessage {
    const wakuMsg = proto.WakuMessage.decode(Reader.create(bytes));
    return new WakuMessage(wakuMsg);
  }

  encode(): Uint8Array {
    return proto.WakuMessage.encode(this.proto).finish();
  }

  get payloadAsUtf8(): string {
    if (!this.proto.payload) {
      return '';
    }

    return Array.from(this.proto.payload)
      .map((char) => {
        return String.fromCharCode(char);
      })
      .join('');
  }

  get payload(): Uint8Array | undefined {
    return this.proto.payload;
  }

  get contentTopic(): string | undefined {
    return this.proto.contentTopic;
  }

  get version(): number | undefined {
    return this.proto.version;
  }

  get timestamp(): Date | undefined {
    if (this.proto.timestamp) {
      return new Date(this.proto.timestamp * 1000);
    }
    return;
  }
}
