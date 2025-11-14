import { TypedEventEmitter } from "@libp2p/interface";
import { MessageId } from "@waku/sds";
import { Logger } from "@waku/utils";

const log = new Logger("sds:sync-status");

export const StatusEvent = {
  /**
   * We are not aware of any missing messages that we may be able to get
   * We MAY have messages lost forever, see the `event.detail`
   */
  Synced: "synced", // TODO or synced or health or caught-up?
  /**
   * We are aware of missing messages that we may be able to get
   */
  Syncing: "syncing" // TODO: it assumes "syncing" is happening via SDS repair or store queries
};

export type StatusEvent = (typeof StatusEvent)[keyof typeof StatusEvent];

export type StatusDetail = {
  /**
   * number of received messages
   */
  received: number;
  /**
   * number of missing messages that are not yet considered as irretrievably lost
   */
  missing: number;
  /**
   * number of messages considered as irretrievably lost
   */
  lost: number;
};

export interface StatusEvents {
  synced: CustomEvent<StatusDetail>;
  syncing: CustomEvent<StatusDetail>;
}

export class SyncStatus extends TypedEventEmitter<StatusEvents> {
  private readonly receivedMessages: Set<MessageId>;
  private readonly missingMessages: Set<MessageId>;
  private readonly lostMessages: Set<MessageId>;

  public constructor() {
    super();

    this.receivedMessages = new Set();
    this.missingMessages = new Set();
    this.lostMessages = new Set();
  }

  /**
   * Cleanup all tracked message IDs. Should be called when stopping the channel.
   */
  public cleanUp(): void {
    this.receivedMessages.clear();
    this.missingMessages.clear();
    this.lostMessages.clear();
  }

  public onMessagesReceived(...messageIds: MessageId[]): void {
    for (const messageId of messageIds) {
      this.missingMessages.delete(messageId);
      this.lostMessages.delete(messageId);
      this.receivedMessages.add(messageId);
    }
    this.safeSend();
  }

  public onMessagesMissing(...messageIds: MessageId[]): void {
    for (const messageId of messageIds) {
      if (
        !this.receivedMessages.has(messageId) &&
        !this.lostMessages.has(messageId)
      ) {
        this.missingMessages.add(messageId);
      } else {
        log.error(
          "A message previously received or lost has been marked as missing",
          messageId
        );
      }
    }
    this.safeSend();
  }

  public onMessagesLost(...messageIds: MessageId[]): void {
    for (const messageId of messageIds) {
      this.missingMessages.delete(messageId);
      this.lostMessages.add(messageId);
    }
    this.safeSend();
  }

  private safeSend(): void {
    const statusEvent =
      this.missingMessages.size === 0
        ? StatusEvent.Synced
        : StatusEvent.Syncing;
    try {
      this.dispatchEvent(
        new CustomEvent(statusEvent, {
          detail: {
            received: this.receivedMessages.size,
            missing: this.missingMessages.size,
            lost: this.lostMessages.size
          }
        })
      );
    } catch (error) {
      log.error(`Failed to dispatch sync status:`, error);
    }
  }
}
