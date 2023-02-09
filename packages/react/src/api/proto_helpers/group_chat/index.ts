import { bytesToUtf8, utf8ToBytes } from "@waku/byte-utils";

import * as proto from "./proto/chat_message";

/**
 * ChatMessage is used by the various show case waku apps that demonstrates
 * waku used as the network layer for chat group applications.
 *
 * This is included to help building PoC and MVPs. Apps that aim to be
 * production ready should use a more appropriate data structure.
 */
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
    const timestampNumber = BigInt(Math.floor(timestamp.valueOf() / 1000));
    const payload = utf8ToBytes(text);

    return new ChatMessage({
      timestamp: timestampNumber,
      nick,
      payload,
    });
  }

  /**
   * Decode a protobuf payload to a ChatMessage.
   * @param bytes The payload to decode.
   */
  static decode(bytes: Uint8Array): ChatMessage {
    const protoMsg = proto.ChatMessage.decode(bytes);
    return new ChatMessage(protoMsg);
  }

  /**
   * Encode this ChatMessage to a byte array, to be used as a protobuf payload.
   * @returns The encoded payload.
   */
  encode(): Uint8Array {
    return proto.ChatMessage.encode(this.proto);
  }

  get timestamp(): Date {
    return new Date(Number(BigInt(this.proto.timestamp) * BigInt(1000)));
  }

  get nick(): string {
    return this.proto.nick;
  }

  get payloadAsUtf8(): string {
    if (!this.proto.payload) {
      return "";
    }

    return bytesToUtf8(this.proto.payload);
  }
}
