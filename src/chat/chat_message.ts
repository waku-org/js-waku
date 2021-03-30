import { Reader } from 'protobufjs/minimal';

import { ChatMessageProto } from '../proto/chat/v2/chat_message';

export class ChatMessage {
  public constructor(
    public timestamp: Date,
    public nick: string,
    public message: string
  ) {}

  static decode(bytes: Uint8Array): ChatMessage {
    const protoMsg = ChatMessageProto.decode(Reader.create(bytes));
    const timestamp = new Date(protoMsg.timestamp * 1000);
    const message = protoMsg.payload
      ? Array.from(protoMsg.payload)
          .map((char) => {
            return String.fromCharCode(char);
          })
          .join('')
      : '';
    return new ChatMessage(timestamp, protoMsg.nick, message);
  }

  encode(): Uint8Array {
    const timestamp = Math.floor(this.timestamp.valueOf() / 1000);
    const payload = Buffer.from(this.message, 'utf-8');

    return ChatMessageProto.encode({
      timestamp,
      nick: this.nick,
      payload,
    }).finish();
  }
}
