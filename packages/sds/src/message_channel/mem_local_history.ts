import { ContentMessage } from "./message.js";
import { SortedArrayBase } from "./sorted_array_base.js";

/**
 * In-Memory implementation of a local store of messages.
 *
 * Messages are store in SDS chronological order:
 * - messages[0] is the oldest message
 * - messages[n] is the newest message
 *
 * Only stores content message: `message.lamportTimestamp` and `message.content` are present.
 */
export class MemLocalHistory extends SortedArrayBase<ContentMessage> {
  protected getCompareFn(): (a: ContentMessage, b: ContentMessage) => number {
    return ContentMessage.compare;
  }

  public push(...items: ContentMessage[]): number {
    for (const item of items) {
      this.validateAndAddMessage(item);
    }
    this.sort();
    return this.items.length;
  }

  public unshift(...items: ContentMessage[]): number {
    for (const item of items) {
      this.validateMessage(item);
    }
    const result = this.items.unshift(...items);
    this.sort();
    return result;
  }

  public fill(
    value: ContentMessage,
    start?: number,
    end?: number
  ): ContentMessage[] {
    this.validateMessage(value);
    this.items.fill(value, start, end);
    this.sort();
    return this.items;
  }

  private validateMessage(message: ContentMessage): void {
    if (
      !message.lamportTimestamp ||
      !message.content ||
      !message.content.length ||
      !message.messageId
    ) {
      throw new Error(
        "Message must have lamportTimestamp and content defined, sync and ephemeral messages cannot be stored"
      );
    }
  }

  private validateAndAddMessage(newMessage: ContentMessage): void {
    this.validateMessage(newMessage);

    // Check if the entry is already present
    const existingHistoryEntry = this.items.find(
      ({ messageId }) => newMessage.messageId === messageId
    );

    // If history entry is already present, no need to re-add
    if (!existingHistoryEntry) {
      this.items.push(newMessage);
    }
  }
}
