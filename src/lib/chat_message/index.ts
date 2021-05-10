import { Reader } from 'protobufjs/minimal';

import * as proto from '../../proto/chat/v2/chat_message';

export class ChatMessage {
  public constructor(public proto: proto.ChatMessage) {}

  /**
   * Create Chat Message with a utf-8 string as payload.
   */
  static fromUtf8String(
    timestamp: Date,
    nick: string,
    text: string
  ): ChatMessage {
    const timestampNumber = Math.floor(timestamp.valueOf() / 1000);
    const payload = Buffer.from(text, 'utf-8');

    return new ChatMessage({
      timestamp: timestampNumber,
      nick,
      payload,
    });
  }

  static decode(bytes: Uint8Array): ChatMessage {
    const protoMsg = proto.ChatMessage.decode(Reader.create(bytes));
    return new ChatMessage(protoMsg);
  }

  encode(): Uint8Array {
    return proto.ChatMessage.encode(this.proto).finish();
  }

  get timestamp(): Date {
    return new Date(this.proto.timestamp * 1000);
  }

  get nick(): string {
    return this.proto.nick;
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
}
