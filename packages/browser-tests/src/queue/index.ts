// Message queue to store received messages by content topic
export interface QueuedMessage {
  payload: number[] | undefined;
  contentTopic: string;
  timestamp: number;
  receivedAt: number;
}

export interface MessageQueue {
  [contentTopic: string]: QueuedMessage[];
}

// Global message queue storage
const messageQueue: MessageQueue = {};

/**
 * Store a message in the queue
 */
export function storeMessage(message: QueuedMessage): void {
  const { contentTopic } = message;

  if (!messageQueue[contentTopic]) {
    messageQueue[contentTopic] = [];
  }

  messageQueue[contentTopic].push(message);
}

/**
 * Get messages for a specific content topic
 */
export function getMessages(
  contentTopic: string,
  options?: {
    startTime?: number;
    endTime?: number;
    pageSize?: number;
    ascending?: boolean;
  }
): QueuedMessage[] {
  if (!messageQueue[contentTopic]) {
    return [];
  }

  let messages = [...messageQueue[contentTopic]];

  // Filter by time if specified
  if (options?.startTime || options?.endTime) {
    messages = messages.filter((msg) => {
      const afterStart = options.startTime
        ? msg.timestamp >= options.startTime
        : true;
      const beforeEnd = options.endTime
        ? msg.timestamp <= options.endTime
        : true;
      return afterStart && beforeEnd;
    });
  }

  // Sort by timestamp
  messages.sort((a, b) => {
    return options?.ascending
      ? a.timestamp - b.timestamp
      : b.timestamp - a.timestamp;
  });

  // Limit result size
  if (options?.pageSize && options.pageSize > 0) {
    messages = messages.slice(0, options.pageSize);
  }

  return messages;
}

/**
 * Clear all messages from the queue
 */
export function clearQueue(): void {
  Object.keys(messageQueue).forEach((topic) => {
    delete messageQueue[topic];
  });
}

/**
 * Get all content topics in the queue
 */
export function getContentTopics(): string[] {
  return Object.keys(messageQueue);
}
