import { TypedEventEmitter } from "@libp2p/interface";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

import { DefaultBloomFilter } from "../bloom_filter/bloom.js";

import { Command, Handlers, ParamsByAction, Task } from "./command_queue.js";
import {
  ChannelId,
  HistoryEntry,
  Message,
  MessageChannelEvent,
  MessageChannelEvents
} from "./events.js";

export const DEFAULT_BLOOM_FILTER_OPTIONS = {
  capacity: 10000,
  errorRate: 0.001
};

const DEFAULT_CAUSAL_HISTORY_SIZE = 2;
const DEFAULT_RECEIVED_MESSAGE_TIMEOUT = 1000 * 60 * 5; // 5 minutes

interface MessageChannelOptions {
  causalHistorySize?: number;
  receivedMessageTimeoutEnabled?: boolean;
  receivedMessageTimeout?: number;
}

export class MessageChannel extends TypedEventEmitter<MessageChannelEvents> {
  private lamportTimestamp: number;
  private filter: DefaultBloomFilter;
  private outgoingBuffer: Message[];
  private acknowledgements: Map<string, number>;
  private incomingBuffer: Message[];
  private localHistory: { timestamp: number; historyEntry: HistoryEntry }[];
  public channelId: ChannelId;
  private causalHistorySize: number;
  private acknowledgementCount: number;
  private timeReceived: Map<string, number>;
  private receivedMessageTimeoutEnabled: boolean;
  private receivedMessageTimeout: number;

  private tasks: Task[] = [];
  private handlers: Handlers = {
    [Command.Send]: async (
      params: ParamsByAction[Command.Send]
    ): Promise<void> => {
      await this._sendMessage(params.payload, params.callback);
    },
    [Command.Receive]: async (
      params: ParamsByAction[Command.Receive]
    ): Promise<void> => {
      this._receiveMessage(params.message);
    },
    [Command.SendEphemeral]: async (
      params: ParamsByAction[Command.SendEphemeral]
    ): Promise<void> => {
      await this._sendEphemeralMessage(params.payload, params.callback);
    }
  };

  public constructor(
    channelId: ChannelId,
    options: MessageChannelOptions = {}
  ) {
    super();
    this.channelId = channelId;
    this.lamportTimestamp = 0;
    this.filter = new DefaultBloomFilter(DEFAULT_BLOOM_FILTER_OPTIONS);
    this.outgoingBuffer = [];
    this.acknowledgements = new Map();
    this.incomingBuffer = [];
    this.localHistory = [];
    this.causalHistorySize =
      options.causalHistorySize ?? DEFAULT_CAUSAL_HISTORY_SIZE;
    this.acknowledgementCount = this.getAcknowledgementCount();
    this.timeReceived = new Map();
    this.receivedMessageTimeoutEnabled =
      options.receivedMessageTimeoutEnabled ?? false;
    this.receivedMessageTimeout =
      options.receivedMessageTimeout ?? DEFAULT_RECEIVED_MESSAGE_TIMEOUT;
  }

  // Periodically called by the library consumer to process async operations
  // in a sequential manner.
  public async processTasks(): Promise<void> {
    while (this.tasks.length > 0) {
      const item = this.tasks.shift();
      if (!item) {
        continue;
      }

      // Use a generic helper function to ensure type safety
      await this.executeTask(item);
    }
  }

  private async executeTask<A extends Command>(item: Task<A>): Promise<void> {
    const handler = this.handlers[item.command];
    await handler(item.params as ParamsByAction[A]);
  }

  public static getMessageId(payload: Uint8Array): string {
    return bytesToHex(sha256(payload));
  }

  /**
   * Send a message to the SDS channel.
   *
   * Increments the lamport timestamp, constructs a `Message` object
   * with the given payload, and adds it to the outgoing buffer.
   *
   * If the callback is successful, the message is also added to
   * the bloom filter and message history. In the context of
   * Waku, this likely means the message was published via
   * light push or relay.
   *
   * See https://rfc.vac.dev/vac/raw/sds/#send-message
   *
   * @param payload - The payload to send.
   * @param callback - A callback function that returns a boolean indicating whether the message was sent successfully.
   */
  public async sendMessage(
    payload: Uint8Array,
    callback?: (message: Message) => Promise<{
      success: boolean;
      retrievalHint?: Uint8Array;
    }>
  ): Promise<void> {
    this.tasks.push({
      command: Command.Send,
      params: {
        payload,
        callback
      }
    });
  }

  public async _sendMessage(
    payload: Uint8Array,
    callback?: (message: Message) => Promise<{
      success: boolean;
      retrievalHint?: Uint8Array;
    }>
  ): Promise<void> {
    this.lamportTimestamp++;

    const messageId = MessageChannel.getMessageId(payload);

    const message: Message = {
      messageId,
      channelId: this.channelId,
      lamportTimestamp: this.lamportTimestamp,
      causalHistory: this.localHistory
        .slice(-this.causalHistorySize)
        .map(({ historyEntry }) => historyEntry),
      bloomFilter: this.filter.toBytes(),
      content: payload
    };

    this.outgoingBuffer.push(message);

    if (callback) {
      const { success, retrievalHint } = await callback(message);
      if (success) {
        this.filter.insert(messageId);
        this.localHistory.push({
          timestamp: this.lamportTimestamp,
          historyEntry: {
            messageId,
            retrievalHint
          }
        });
        this.timeReceived.set(messageId, Date.now());
        this.safeDispatchEvent(MessageChannelEvent.MessageSent, {
          detail: message
        });
      }
    }
  }

  /**
   * Sends a short-lived message without synchronization or reliability requirements.
   *
   * Sends a message without a timestamp, causal history, or bloom filter.
   * Ephemeral messages are not added to the outgoing buffer.
   * Upon reception, ephemeral messages are delivered immediately without
   * checking for causal dependencies or including in the local log.
   *
   * See https://rfc.vac.dev/vac/raw/sds/#ephemeral-messages
   *
   * @param payload - The payload to send.
   * @param callback - A callback function that returns a boolean indicating whether the message was sent successfully.
   */
  public async sendEphemeralMessage(
    payload: Uint8Array,
    callback?: (message: Message) => Promise<boolean>
  ): Promise<void> {
    this.tasks.push({
      command: Command.SendEphemeral,
      params: {
        payload,
        callback
      }
    });
  }

  public async _sendEphemeralMessage(
    payload: Uint8Array,
    callback?: (message: Message) => Promise<boolean>
  ): Promise<void> {
    const message: Message = {
      messageId: MessageChannel.getMessageId(payload),
      channelId: this.channelId,
      content: payload,
      lamportTimestamp: undefined,
      causalHistory: [],
      bloomFilter: undefined
    };

    if (callback) {
      await callback(message);
    }
  }

  /**
   * Process a received SDS message for this channel.
   *
   * Review the acknowledgement status of messages in the outgoing buffer
   * by inspecting the received message's bloom filter and causal history.
   * Add the received message to the bloom filter.
   * If the local history contains every message in the received message's
   * causal history, deliver the message. Otherwise, add the message to the
   * incoming buffer.
   *
   * See https://rfc.vac.dev/vac/raw/sds/#receive-message
   *
   * @param message - The received SDS message.
   */

  public receiveMessage(message: Message): void {
    this.tasks.push({
      command: Command.Receive,
      params: {
        message
      }
    });
  }

  public _receiveMessage(message: Message): void {
    if (this.timeReceived.has(message.messageId)) {
      // Received a duplicate message
      return;
    }

    if (!message.lamportTimestamp) {
      // Messages with no timestamp are ephemeral messages and should be delivered immediately
      this.safeDispatchEvent(MessageChannelEvent.SyncReceived, {
        detail: message
      });
      this.deliverMessage(message);
      return;
    }
    this.safeDispatchEvent(MessageChannelEvent.MessageReceived, {
      detail: message
    });
    // review ack status
    this.reviewAckStatus(message);
    // add to bloom filter (skip for messages with empty content)
    if (message.content?.length && message.content.length > 0) {
      this.filter.insert(message.messageId);
    }
    // verify causal history
    const dependenciesMet = message.causalHistory.every((historyEntry) =>
      this.localHistory.some(
        ({ historyEntry: { messageId } }) =>
          messageId === historyEntry.messageId
      )
    );
    if (!dependenciesMet) {
      this.incomingBuffer.push(message);
      this.timeReceived.set(message.messageId, Date.now());
    } else {
      this.deliverMessage(message);
      this.safeDispatchEvent(MessageChannelEvent.MessageDelivered, {
        detail: {
          messageId: message.messageId,
          sentOrReceived: "received"
        }
      });
    }
  }

  // https://rfc.vac.dev/vac/raw/sds/#periodic-incoming-buffer-sweep
  // Note that even though this function has side effects, it is not async
  // and does not need to be called through the queue.
  public sweepIncomingBuffer(): HistoryEntry[] {
    const { buffer, missing } = this.incomingBuffer.reduce<{
      buffer: Message[];
      missing: HistoryEntry[];
    }>(
      ({ buffer, missing }, message) => {
        // Check each message for missing dependencies
        const missingDependencies = message.causalHistory.filter(
          (messageHistoryEntry) =>
            !this.localHistory.some(
              ({ historyEntry: { messageId } }) =>
                messageId === messageHistoryEntry.messageId
            )
        );
        if (missingDependencies.length === 0) {
          // Any message with no missing dependencies is delivered
          // and removed from the buffer (implicitly by not adding it to the new incoming buffer)
          this.deliverMessage(message);
          this.safeDispatchEvent(MessageChannelEvent.MessageDelivered, {
            detail: {
              messageId: message.messageId,
              sentOrReceived: "received"
            }
          });
          return { buffer, missing };
        }

        // Optionally, if a message has not been received after a predetermined amount of time,
        // it is marked as irretrievably lost (implicitly by removing it from the buffer without delivery)
        if (this.receivedMessageTimeoutEnabled) {
          const timeReceived = this.timeReceived.get(message.messageId);
          if (
            timeReceived &&
            Date.now() - timeReceived > this.receivedMessageTimeout
          ) {
            return { buffer, missing };
          }
        }
        // Any message with missing dependencies stays in the buffer
        // and the missing message IDs are returned for processing.
        return {
          buffer: buffer.concat(message),
          missing: missing.concat(missingDependencies)
        };
      },
      { buffer: new Array<Message>(), missing: new Array<HistoryEntry>() }
    );
    // Update the incoming buffer to only include messages with no missing dependencies
    this.incomingBuffer = buffer;
    if (missing.length > 0) {
      this.safeDispatchEvent(MessageChannelEvent.MissedMessages, {
        detail: missing
      });
    }
    return missing;
  }

  // https://rfc.vac.dev/vac/raw/sds/#periodic-outgoing-buffer-sweep
  public sweepOutgoingBuffer(): {
    unacknowledged: Message[];
    possiblyAcknowledged: Message[];
  } {
    // Partition all messages in the outgoing buffer into unacknowledged and possibly acknowledged messages
    return this.outgoingBuffer.reduce<{
      unacknowledged: Message[];
      possiblyAcknowledged: Message[];
    }>(
      ({ unacknowledged, possiblyAcknowledged }, message) => {
        if (this.acknowledgements.has(message.messageId)) {
          return {
            unacknowledged,
            possiblyAcknowledged: possiblyAcknowledged.concat(message)
          };
        }
        return {
          unacknowledged: unacknowledged.concat(message),
          possiblyAcknowledged
        };
      },
      {
        unacknowledged: new Array<Message>(),
        possiblyAcknowledged: new Array<Message>()
      }
    );
  }

  /**
   * Send a sync message to the SDS channel.
   *
   * Increments the lamport timestamp, constructs a `Message` object
   * with an empty load. Skips outgoing buffer, filter, and local log.
   *
   * See https://rfc.vac.dev/vac/raw/sds/#send-sync-message
   *
   * @param callback - A callback function that returns a boolean indicating whether the message was sent successfully.
   */
  public async sendSyncMessage(
    callback?: (message: Message) => Promise<boolean>
  ): Promise<boolean> {
    this.lamportTimestamp++;

    const emptyMessage = new Uint8Array();

    const message: Message = {
      messageId: MessageChannel.getMessageId(emptyMessage),
      channelId: this.channelId,
      lamportTimestamp: this.lamportTimestamp,
      causalHistory: this.localHistory
        .slice(-this.causalHistorySize)
        .map(({ historyEntry }) => historyEntry),
      bloomFilter: this.filter.toBytes(),
      content: emptyMessage
    };

    if (callback) {
      await callback(message);
      this.safeDispatchEvent(MessageChannelEvent.SyncSent, {
        detail: message
      });
      return true;
    }
    return false;
  }

  // See https://rfc.vac.dev/vac/raw/sds/#deliver-message
  private deliverMessage(message: Message, retrievalHint?: Uint8Array): void {
    const messageLamportTimestamp = message.lamportTimestamp ?? 0;
    if (messageLamportTimestamp > this.lamportTimestamp) {
      this.lamportTimestamp = messageLamportTimestamp;
    }

    if (
      message.content?.length === 0 ||
      message.lamportTimestamp === undefined
    ) {
      // Messages with empty content are sync messages.
      // Messages with no timestamp are ephemeral messages.
      // They are not added to the local log or bloom filter.
      return;
    }

    // The participant MUST insert the message ID into its local log,
    // based on Lamport timestamp.
    // If one or more message IDs with the same Lamport timestamp already exists,
    // the participant MUST follow the Resolve Conflicts procedure.
    // https://rfc.vac.dev/vac/raw/sds/#resolve-conflicts
    this.localHistory.push({
      timestamp: messageLamportTimestamp,
      historyEntry: {
        messageId: message.messageId,
        retrievalHint
      }
    });
    this.localHistory.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.historyEntry.messageId.localeCompare(b.historyEntry.messageId);
    });
  }

  // For each received message (including sync messages), inspect the causal history and bloom filter
  // to determine the acknowledgement status of messages in the outgoing buffer.
  // See https://rfc.vac.dev/vac/raw/sds/#review-ack-status
  private reviewAckStatus(receivedMessage: Message): void {
    // the participant MUST mark all messages in the received causal_history as acknowledged.
    receivedMessage.causalHistory.forEach(({ messageId }) => {
      this.outgoingBuffer = this.outgoingBuffer.filter(
        ({ messageId: outgoingMessageId }) => {
          if (outgoingMessageId !== messageId) {
            return true;
          }
          this.safeDispatchEvent(MessageChannelEvent.MessageAcknowledged, {
            detail: messageId
          });
          return false;
        }
      );
      this.acknowledgements.delete(messageId);
      if (!this.filter.lookup(messageId)) {
        this.filter.insert(messageId);
      }
    });
    // the participant MUST mark all messages included in the bloom_filter as possibly acknowledged
    if (!receivedMessage.bloomFilter) {
      return;
    }
    const messageBloomFilter = DefaultBloomFilter.fromBytes(
      receivedMessage.bloomFilter,
      this.filter.options
    );
    this.outgoingBuffer = this.outgoingBuffer.filter((message) => {
      if (!messageBloomFilter.lookup(message.messageId)) {
        return true;
      }
      // If a message appears as possibly acknowledged in multiple received bloom filters,
      // the participant MAY mark it as acknowledged based on probabilistic grounds,
      // taking into account the bloom filter size and hash number.
      const count = (this.acknowledgements.get(message.messageId) ?? 0) + 1;
      if (count < this.acknowledgementCount) {
        this.acknowledgements.set(message.messageId, count);
        this.safeDispatchEvent(MessageChannelEvent.PartialAcknowledgement, {
          detail: {
            messageId: message.messageId,
            count
          }
        });
        return true;
      }
      this.acknowledgements.delete(message.messageId);
      return false;
    });
  }

  // TODO: this should be determined based on the bloom filter parameters and number of hashes
  private getAcknowledgementCount(): number {
    return 2;
  }
}
