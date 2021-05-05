import { ChatMessage as WakuChatMessage } from 'waku/chat_message';

export class ChatMessage {
  constructor(
    public receivedTimestampMs: Date,
    public sentTimestamp: Date,
    public nick: string,
    public message: string
  ) {}

  static fromWakuChatMessage(wakuChatMessage: WakuChatMessage): ChatMessage {
    return new ChatMessage(
      new Date(),
      wakuChatMessage.timestamp,
      wakuChatMessage.nick,
      wakuChatMessage.message
    );
  }
}
