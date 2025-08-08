import { Message } from "./events.js";

type ContentMessage = Message & {
  lamportTimestamp: number;
  content: Uint8Array<ArrayBufferLike>;
};

/**
 * In-Memory implementation of [[ILocalHistory]].
 *
 * Messages are store in SDS chronological order:
 * - messages[0] is the oldest message
 * - mesa
 *
 * Only stores content message: `message.lamportTimestamp` and `message.content` are present.
 */
export class LocalHistory {
  private messages: Array<ContentMessage>;

  public constructor() {
    this.messages = [];
  }

  /**
   * Push a message,
   *
   * @param newMessage
   *
   * @throws Error if `newMessage.lamportTimestamp` or `newMessage.content` are empty or undefined
   */
  public _push(newMessage: ContentMessage): void {
    if (
      !newMessage.lamportTimestamp ||
      !newMessage.content ||
      !newMessage.content.length ||
      !newMessage.messageId
    ) {
      throw new Error(
        "Message must have lamportTimestamp and content defined, sync and ephemeral messages cannot be stored"
      );
    }

    // Check if the entry is already present
    const existingHistoryEntry = this.messages.find(
      ({ messageId }) => newMessage.messageId === messageId
    );

    // The history entry is already present, no need to re-add
    if (existingHistoryEntry) {
      return;
    }

    this.messages.push(newMessage);
    this._sort();
  }

  private _sort(): void {
    this.messages.sort(Message.compare);
  }
}
