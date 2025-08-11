import { IDecodedMessage, ProtocolError } from "@waku/interfaces";
import type { HistoryEntry, MessageId } from "@waku/sds";

export enum ReliableChannelEvent {
  /**
   * The message is being sent over the wire.
   *
   * This event may be emitted several times if the retry mechanism kicks in.
   */
  OutMessageSending = "channel:out:message-sending",
  /**
   * The message has been sent over the wire but has not been acknowledged by
   * any other party yet.
   *
   * We are now waiting for acknowledgements.
   *
   * This event may be emitted several times if the
   * several times if the retry mechanisms kicks in.
   */
  OutMessageSent = "channel:out:message-sent",
  /**
   * A received bloom filter seems to indicate that the messages was received
   * by another party.
   *
   * However, this is probabilistic. The retry mechanism will wait a bit longer
   * before trying to send the message again.
   */
  OutMessagePossiblyAcknowledged = "channel:out:message-possibly-acknowledged",
  /**
   * The message was fully acknowledged by other members of the channel
   */
  OutMessageAcknowledged = "channel:out:message-acknowledged",
  /**
   * The retry mechanism failed too many times, and the message is not considered
   * as sent. TODO: implement
   */
  OutMessageRetriesError = "channel:out:message-retries-error",
  /**
   * It was not possible to send the messages due to a non-recoverable error,
   * most likely an internal error for a developer to resolve.
   */
  OutMessageIrrecoverableError = "channel:out:message-irrecoverable-error",
  /**
   * A new message has been received.
   */
  InMessageReceived = "channel:in:message-received",
  /**
   * We are aware of a missing message but failed to retrieve it successfully.
   */
  InIrretrievableMessage = "channel:in:message-irretrievable"
}

export type ReliableChannelEvents = {
  [ReliableChannelEvent.OutMessageSending]: CustomEvent<MessageId>;
  [ReliableChannelEvent.OutMessageSent]: CustomEvent<MessageId>;
  [ReliableChannelEvent.OutMessagePossiblyAcknowledged]: CustomEvent<{
    messageId: MessageId;
    possibleAckCount: number;
  }>;
  [ReliableChannelEvent.OutMessageAcknowledged]: CustomEvent<MessageId>;
  [ReliableChannelEvent.OutMessageRetriesError]: CustomEvent<MessageId>;
  // TODO probably T extends IDecodedMessage?
  [ReliableChannelEvent.InMessageReceived]: CustomEvent<IDecodedMessage>;
  [ReliableChannelEvent.InIrretrievableMessage]: CustomEvent<HistoryEntry>;
  [ReliableChannelEvent.OutMessageIrrecoverableError]: CustomEvent<{
    messageId: MessageId;
    error: ProtocolError;
  }>;
};
