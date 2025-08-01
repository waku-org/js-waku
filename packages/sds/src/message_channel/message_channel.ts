import { TypedEventEmitter } from "@libp2p/interface";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";
import { Logger } from "@waku/utils";

import { DefaultBloomFilter } from "../bloom_filter/bloom.js";

import { Command, Handlers, ParamsByAction, Task } from "./command_queue.js";
import {
  ChannelId,
  HistoryEntry,
  Message,
  MessageChannelEvent,
  MessageChannelEvents,
  type MessageId
} from "./events.js";

export const DEFAULT_BLOOM_FILTER_OPTIONS = {
  capacity: 10000,
  errorRate: 0.001
};

const DEFAULT_CAUSAL_HISTORY_SIZE = 2;
const DEFAULT_RECEIVED_MESSAGE_TIMEOUT = 1000 * 60 * 5; // 5 minutes

const log = new Logger("sds:message-channel");

interface MessageChannelOptions {
  causalHistorySize?: number;
  receivedMessageTimeoutEnabled?: boolean;
  receivedMessageTimeout?: number;
}

export class MessageChannel extends TypedEventEmitter<MessageChannelEvents> {
  public readonly channelId: ChannelId;
  private lamportTimestamp: number;
  private filter: DefaultBloomFilter;
  private outgoingBuffer: Message[];
  private acknowledgements: Map<MessageId, number>;
  private incomingBuffer: Message[];
  private localHistory: { timestamp: number; historyEntry: HistoryEntry }[];
  private causalHistorySize: number;
  private readonly acknowledgementCount: number;
  private timeReceived: Map<MessageId, number>;
  private readonly receivedMessageTimeoutEnabled: boolean;
  private readonly receivedMessageTimeout: number;

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
    this.outgoingMessages = new Set();
  }

  public static getMessageId(payload: Uint8Array): MessageId {
    return bytesToHex(sha256(payload));
  }

  /**
   * Processes all queued tasks sequentially to ensure proper message ordering.
   *
   * This method should be called periodically by the library consumer to execute
   * queued send/receive operations in the correct sequence.
   *
   * @example
   * ```typescript
   * const channel = new MessageChannel("my-channel");
   *
   * // Queue some operations
   * await channel.sendMessage(payload, callback);
   * channel.receiveMessage(incomingMessage);
   *
   * // Process all queued operations
   * await channel.processTasks();
   * ```
   *
   * @throws Will emit a 'taskError' event if any task fails, but continues processing remaining tasks
   */
  public async processTasks(): Promise<void> {
    while (this.tasks.length > 0) {
      const item = this.tasks.shift();
      if (!item) {
        continue;
      }

      await this.executeTask(item);
    }
  }

  /**
   * Queues a message to be sent on this channel.
   *
   * The message will be processed sequentially when processTasks() is called.
   * This ensures proper lamport timestamp ordering and causal history tracking.
   *
   * @param payload - The message content as a byte array
   * @param callback - Optional callback function called after the message is processed
   * @returns Promise that resolves when the message is queued (not sent)
   *
   * @example
   * ```typescript
   * const channel = new MessageChannel("chat-room");
   * const message = new TextEncoder().encode("Hello, world!");
   *
   * await channel.sendMessage(message, async (processedMessage) => {
   *   console.log("Message processed:", processedMessage.messageId);
   *   return { success: true };
   * });
   *
   * // Actually send the message
   * await channel.processTasks();
   * ```
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

  /**
   * Queues a received message for processing.
   *
   * The message will be processed when processTasks() is called, ensuring
   * proper dependency resolution and causal ordering.
   *
   * @param message - The message to receive and process
   *
   * @example
   * ```typescript
   * const channel = new MessageChannel("chat-room");
   *
   * // Receive a message from the network
   * channel.receiveMessage(incomingMessage);
   *
   * // Process the received message
   * await channel.processTasks();
   * ```
   */
  public receiveMessage(message: Message): void {
    this.tasks.push({
      command: Command.Receive,
      params: {
        message
      }
    });
  }

  /**
   * Processes messages in the incoming buffer, delivering those with satisfied dependencies.
   *
   * @returns Array of history entries for messages still missing dependencies
   */
  public sweepIncomingBuffer(): HistoryEntry[] {
    const { buffer, missing } = this.incomingBuffer.reduce<{
      buffer: Message[];
      missing: Set<HistoryEntry>;
    }>(
      ({ buffer, missing }, message) => {
        const missingDependencies = message.causalHistory.filter(
          (messageHistoryEntry) =>
            !this.localHistory.some(
              ({ historyEntry: { messageId } }) =>
                messageId === messageHistoryEntry.messageId
            )
        );
        if (missingDependencies.length === 0) {
          this.deliverMessage(message);
          this.safeSendEvent(MessageChannelEvent.MessageDelivered, {
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
        missingDependencies.forEach((dependency) => {
          missing.add(dependency);
        });
        return {
          buffer: buffer.concat(message),
          missing
        };
      },
      { buffer: new Array<Message>(), missing: new Set<HistoryEntry>() }
    );
    this.incomingBuffer = buffer;

    this.safeSendEvent(MessageChannelEvent.MissedMessages, {
      detail: Array.from(missing)
    });

    return Array.from(missing);
  }

  // https://rfc.vac.dev/vac/raw/sds/#periodic-outgoing-buffer-sweep
  public sweepOutgoingBuffer(): {
    unacknowledged: Message[];
    possiblyAcknowledged: Message[];
  } {
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
      try {
        await callback(message);
        this.safeSendEvent(MessageChannelEvent.SyncSent, {
          detail: message
        });
        return true;
      } catch (error) {
        log.error("Callback execution failed in sendSyncMessage:", error);
        throw error;
      }
    }
    return false;
  }

  private _receiveMessage(message: Message): void {
    const isDuplicate =
      message.content &&
      message.content.length > 0 &&
      this.timeReceived.has(message.messageId);

    if (isDuplicate) {
      return;
    }

    const isOwnOutgoingMessage =
      message.content &&
      message.content.length > 0 &&
      this.outgoingMessages.has(MessageChannel.getMessageId(message.content));

    if (isOwnOutgoingMessage) {
      return;
    }

    if (!message.lamportTimestamp) {
      this.deliverMessage(message);
      return;
    }
    if (message.content?.length === 0) {
      this.safeSendEvent(MessageChannelEvent.SyncReceived, {
        detail: message
      });
    } else {
      this.safeSendEvent(MessageChannelEvent.MessageReceived, {
        detail: message
      });
    }
    this.reviewAckStatus(message);
    if (message.content?.length && message.content.length > 0) {
      this.filter.insert(message.messageId);
    }
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
      this.safeSendEvent(MessageChannelEvent.MessageDelivered, {
        detail: {
          messageId: message.messageId,
          sentOrReceived: "received"
        }
      });
    }
  }

  private async executeTask<A extends Command>(item: Task<A>): Promise<void> {
    try {
      const handler = this.handlers[item.command];
      await handler(item.params as ParamsByAction[A]);
    } catch (error) {
      log.error(`Task execution failed for command ${item.command}:`, error);
      this.dispatchEvent(
        new CustomEvent("taskError", {
          detail: { command: item.command, error, params: item.params }
        })
      );
    }
  }

  private safeSendEvent<T extends MessageChannelEvent>(
    event: T,
    eventInit?: CustomEventInit
  ): void {
    try {
      this.dispatchEvent(new CustomEvent(event, eventInit));
    } catch (error) {
      log.error(`Failed to dispatch event ${event}:`, error);
    }
  }

  private async _sendMessage(
    payload: Uint8Array,
    callback?: (message: Message) => Promise<{
      success: boolean;
      retrievalHint?: Uint8Array;
    }>
  ): Promise<void> {
    this.lamportTimestamp++;

    const messageId = MessageChannel.getMessageId(payload);

    this.outgoingMessages.add(messageId);

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
      try {
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
          this.safeSendEvent(MessageChannelEvent.MessageSent, {
            detail: message
          });
        }
      } catch (error) {
        log.error("Callback execution failed in _sendMessage:", error);
        throw error;
      }
    }
  }

  private async _sendEphemeralMessage(
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
      try {
        await callback(message);
      } catch (error) {
        log.error("Callback execution failed in _sendEphemeralMessage:", error);
        throw error;
      }
    }
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
    receivedMessage.causalHistory.forEach(({ messageId }) => {
      this.outgoingBuffer = this.outgoingBuffer.filter(
        ({ messageId: outgoingMessageId }) => {
          if (outgoingMessageId !== messageId) {
            return true;
          }
          this.safeSendEvent(MessageChannelEvent.MessageAcknowledged, {
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
        this.safeSendEvent(MessageChannelEvent.PartialAcknowledgement, {
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
