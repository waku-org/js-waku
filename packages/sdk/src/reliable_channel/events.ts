import { IDecodedMessage, ProtocolError } from "@waku/interfaces";
import type { HistoryEntry, MessageId } from "@waku/sds";

export const ReliableChannelEvent = {
  /**
   * The message is being sent over the wire.
   *
   * This event may be emitted several times if the retry mechanism kicks in.
   */
  SendingMessage: "sending-message",
  /**
   * The message has been sent over the wire but has not been acknowledged by
   * any other party yet.
   *
   * We are now waiting for acknowledgements.
   *
   * This event may be emitted several times if the
   * several times if the retry mechanisms kicks in.
   */
  MessageSent: "message-sent",
  /**
   * A received bloom filter seems to indicate that the messages was received
   * by another party.
   *
   * However, this is probabilistic. The retry mechanism will wait a bit longer
   * before trying to send the message again.
   */
  MessagePossiblyAcknowledged: "message-possibly-acknowledged",
  /**
   * The message was fully acknowledged by other members of the channel
   */
  MessageAcknowledged: "message-acknowledged",
  /**
   * It was not possible to send the messages due to a non-recoverable error,
   * most likely an internal error for a developer to resolve.
   */
  SendingMessageIrrecoverableError: "sending-message-irrecoverable-error",
  /**
   * A new message has been received.
   */
  MessageReceived: "message-received",
  /**
   * We are aware of a missing message but failed to retrieve it successfully.
   */
  IrretrievableMessage: "irretrievable-message"
};

export type ReliableChannelEvent =
  (typeof ReliableChannelEvent)[keyof typeof ReliableChannelEvent];

export interface ReliableChannelEvents {
  "sending-message": CustomEvent<MessageId>;
  "message-sent": CustomEvent<MessageId>;
  "message-possibly-acknowledged": CustomEvent<{
    messageId: MessageId;
    possibleAckCount: number;
  }>;
  "message-acknowledged": CustomEvent<MessageId>;
  // TODO probably T extends IDecodedMessage?
  "message-received": CustomEvent<IDecodedMessage>;
  "irretrievable-message": CustomEvent<HistoryEntry>;
  "sending-message-irrecoverable-error": CustomEvent<{
    messageId: MessageId;
    error: ProtocolError;
  }>;
}
