/* eslint-disable no-console */
import { DecodedMessage } from "@waku/core";

import { ChatMessage } from "./index.js";

export class MessageDecoder {
  public chatMessage: ChatMessage;
  // WakuMessage timestamp
  public sentTimestamp: Date | undefined;

  constructor(chatMessage: ChatMessage, sentTimestamp: Date | undefined) {
    this.chatMessage = chatMessage;
    this.sentTimestamp = sentTimestamp;
  }

  static fromWakuMessage(wakuMsg: DecodedMessage): MessageDecoder | undefined {
    if (wakuMsg.payload) {
      try {
        const chatMsg = ChatMessage.decode(wakuMsg.payload);
        if (chatMsg) {
          return new MessageDecoder(chatMsg, wakuMsg.timestamp);
        }
      } catch (e) {
        console.error("Failed to decode chat message", e);
      }
    }
    return;
  }

  static fromUtf8String(nick: string, text: string): MessageDecoder {
    const now = new Date();
    return new MessageDecoder(ChatMessage.fromUtf8String(now, nick, text), now);
  }

  get nick(): string {
    return this.chatMessage.nick;
  }

  get timestamp(): Date {
    return this.chatMessage.timestamp;
  }

  get payloadAsUtf8(): string {
    return this.chatMessage.payloadAsUtf8;
  }
}
