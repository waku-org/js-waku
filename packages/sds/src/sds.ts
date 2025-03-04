import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { proto_sds_message } from "@waku/proto";

import { DefaultBloomFilter } from "./bloom.js";

export type Message = proto_sds_message.SdsMessage;
export type ChannelId = string;

export const DEFAULT_BLOOM_FILTER_OPTIONS = {
  capacity: 10000,
  errorRate: 0.001
};

const DEFAULT_CAUSAL_HISTORY_SIZE = 2;
const DEFAULT_RECEIVED_MESSAGE_TIMEOUT = 1000 * 60 * 5; // 5 minutes

export class MessageChannel {
  private lamportTimestamp: number;
  private filter: DefaultBloomFilter;
  private outgoingBuffer: Message[];
  private acknowledgements: Map<string, number>;
  private incomingBuffer: Message[];
  private messageIdLog: { timestamp: number; messageId: string }[];
  private channelId: ChannelId;
  private causalHistorySize: number;
  private acknowledgementCount: number;
  private timeReceived: Map<string, number>;

  public constructor(
    channelId: ChannelId,
    causalHistorySize: number = DEFAULT_CAUSAL_HISTORY_SIZE,
    private receivedMessageTimeoutEnabled: boolean = false,
    private receivedMessageTimeout: number = DEFAULT_RECEIVED_MESSAGE_TIMEOUT
  ) {
    this.channelId = channelId;
    this.lamportTimestamp = 0;
    this.filter = new DefaultBloomFilter(DEFAULT_BLOOM_FILTER_OPTIONS);
    this.outgoingBuffer = [];
    this.acknowledgements = new Map();
    this.incomingBuffer = [];
    this.messageIdLog = [];
    this.causalHistorySize = causalHistorySize;
    this.acknowledgementCount = this.getAcknowledgementCount();
    this.timeReceived = new Map();
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
    callback?: (message: Message) => Promise<boolean>
  ): Promise<void> {
    this.lamportTimestamp++;

    const messageId = MessageChannel.getMessageId(payload);

    const message: Message = {
      messageId,
      channelId: this.channelId,
      lamportTimestamp: this.lamportTimestamp,
      causalHistory: this.messageIdLog
        .slice(-this.causalHistorySize)
        .map(({ messageId }) => messageId),
      bloomFilter: this.filter.toBytes(),
      content: payload
    };

    this.outgoingBuffer.push(message);

    if (callback) {
      const success = await callback(message);
      if (success) {
        this.filter.insert(messageId);
        this.messageIdLog.push({ timestamp: this.lamportTimestamp, messageId });
      }
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
    // review ack status
    this.reviewAckStatus(message);
    // add to bloom filter (skip for messages with empty content)
    if (message.content?.length && message.content.length > 0) {
      this.filter.insert(message.messageId);
    }
    // verify causal history
    const dependenciesMet = message.causalHistory.every((messageId) =>
      this.messageIdLog.some(
        ({ messageId: logMessageId }) => logMessageId === messageId
      )
    );
    if (!dependenciesMet) {
      this.incomingBuffer.push(message);
      this.timeReceived.set(message.messageId, Date.now());
    } else {
      this.deliverMessage(message);
    }
  }

  // https://rfc.vac.dev/vac/raw/sds/#periodic-incoming-buffer-sweep
  public sweepIncomingBuffer(): string[] {
    const { buffer, missing } = this.incomingBuffer.reduce<{
      buffer: Message[];
      missing: string[];
    }>(
      ({ buffer, missing }, message) => {
        // Check each message for missing dependencies
        const missingDependencies = message.causalHistory.filter(
          (messageId) =>
            !this.messageIdLog.some(
              ({ messageId: logMessageId }) => logMessageId === messageId
            )
        );
        if (missingDependencies.length === 0) {
          // Any message with no missing dependencies is delivered
          // and removed from the buffer (implicitly by not adding it to the new incoming buffer)
          this.deliverMessage(message);
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
      { buffer: new Array<Message>(), missing: new Array<string>() }
    );
    // Update the incoming buffer to only include messages with no missing dependencies
    this.incomingBuffer = buffer;
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
  public sendSyncMessage(
    callback?: (message: Message) => Promise<boolean>
  ): Promise<boolean> {
    this.lamportTimestamp++;

    const emptyMessage = new Uint8Array();

    const message: Message = {
      messageId: MessageChannel.getMessageId(emptyMessage),
      channelId: this.channelId,
      lamportTimestamp: this.lamportTimestamp,
      causalHistory: this.messageIdLog
        .slice(-this.causalHistorySize)
        .map(({ messageId }) => messageId),
      bloomFilter: this.filter.toBytes(),
      content: emptyMessage
    };

    if (callback) {
      return callback(message);
    }
    return Promise.resolve(false);
  }

  // See https://rfc.vac.dev/vac/raw/sds/#deliver-message
  private deliverMessage(message: Message): void {
    const messageLamportTimestamp = message.lamportTimestamp ?? 0;
    if (messageLamportTimestamp > this.lamportTimestamp) {
      this.lamportTimestamp = messageLamportTimestamp;
    }

    if (message.content?.length === 0) {
      // Messages with empty content are sync messages.
      // They are not added to the local log or bloom filter.
      return;
    }

    // The participant MUST insert the message ID into its local log,
    // based on Lamport timestamp.
    // If one or more message IDs with the same Lamport timestamp already exists,
    // the participant MUST follow the Resolve Conflicts procedure.
    // https://rfc.vac.dev/vac/raw/sds/#resolve-conflicts
    this.messageIdLog.push({
      timestamp: messageLamportTimestamp,
      messageId: message.messageId
    });
    this.messageIdLog.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.messageId.localeCompare(b.messageId);
    });
  }

  // For each received message (including sync messages), inspect the causal history and bloom filter
  // to determine the acknowledgement status of messages in the outgoing buffer.
  // See https://rfc.vac.dev/vac/raw/sds/#review-ack-status
  private reviewAckStatus(receivedMessage: Message): void {
    // the participant MUST mark all messages in the received causal_history as acknowledged.
    receivedMessage.causalHistory.forEach((messageId) => {
      this.outgoingBuffer = this.outgoingBuffer.filter(
        (msg) => msg.messageId !== messageId
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
