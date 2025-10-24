import { BloomFilter } from "./bloom_filter/bloom.js";

export {
  MessageChannel,
  MessageChannelEvent,
  MessageChannelOptions,
  isContentMessage,
  isSyncMessage,
  isEphemeralMessage,
  Message,
  ContentMessage,
  SyncMessage,
  EphemeralMessage,
  type HistoryEntry,
  type ChannelId,
  type MessageChannelEvents,
  type ParticipantId,
  type MessageId
} from "./message_channel/index.js";

/**
 * @deprecated Use ParticipantId instead. SenderId has been renamed to ParticipantId
 * to better reflect that it represents a channel participant, not just a message sender.
 */
export type { ParticipantId as SenderId } from "./message_channel/index.js";

export { BloomFilter };
