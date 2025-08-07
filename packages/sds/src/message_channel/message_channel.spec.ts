import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { DefaultBloomFilter } from "../bloom_filter/bloom.js";

import {
  HistoryEntry,
  Message,
  MessageChannelEvent,
  MessageId
} from "./events.js";
import {
  DEFAULT_BLOOM_FILTER_OPTIONS,
  MessageChannel
} from "./message_channel.js";

const channelId = "test-channel";
const callback = (_message: Message): Promise<{ success: boolean }> => {
  return Promise.resolve({ success: true });
};

const getBloomFilter = (channel: MessageChannel): DefaultBloomFilter => {
  return (channel as any).filter as DefaultBloomFilter;
};

const messagesA = ["message-1", "message-2"];
const messagesB = [
  "message-3",
  "message-4",
  "message-5",
  "message-6",
  "message-7"
];

const sendMessage = async (
  channel: MessageChannel,
  payload: Uint8Array,
  callback: (message: Message) => Promise<{ success: boolean }>
): Promise<void> => {
  await channel.pushOutgoingMessage(payload, callback);
  await channel.processTasks();
};

const receiveMessage = async (
  channel: MessageChannel,
  message: Message
): Promise<void> => {
  channel.pushIncomingMessage(message);
  await channel.processTasks();
};

describe("MessageChannel", function () {
  this.timeout(5000);
  let channelA: MessageChannel;
  let channelB: MessageChannel;

  describe("sending a message ", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId, "alice");
    });

    it("should increase lamport timestamp", async () => {
      const timestampBefore = (channelA as any).lamportTimestamp;
      await sendMessage(channelA, new Uint8Array(), callback);
      const timestampAfter = (channelA as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore + 1);
    });

    it("should push the message to the outgoing buffer", async () => {
      const bufferLengthBefore = (channelA as any).outgoingBuffer.length;
      await sendMessage(channelA, new Uint8Array(), callback);
      const bufferLengthAfter = (channelA as any).outgoingBuffer.length;
      expect(bufferLengthAfter).to.equal(bufferLengthBefore + 1);
    });

    it("should insert message into bloom filter", async () => {
      const messageId = MessageChannel.getMessageId(new Uint8Array());
      await sendMessage(channelA, new Uint8Array(), callback);
      const bloomFilter = getBloomFilter(channelA);
      expect(bloomFilter.lookup(messageId)).to.equal(true);
    });

    it("should insert message id into causal history", async () => {
      const expectedTimestamp = (channelA as any).lamportTimestamp + 1;
      const messageId = MessageChannel.getMessageId(new Uint8Array());
      await sendMessage(channelA, new Uint8Array(), callback);
      const messageIdLog = (channelA as any).localHistory as {
        timestamp: number;
        historyEntry: HistoryEntry;
      }[];
      expect(messageIdLog.length).to.equal(1);
      expect(
        messageIdLog.some(
          (log) =>
            log.timestamp === expectedTimestamp &&
            log.historyEntry.messageId === messageId
        )
      ).to.equal(true);
    });

    it("should attach causal history and bloom filter to each message", async () => {
      const bloomFilter = new DefaultBloomFilter(DEFAULT_BLOOM_FILTER_OPTIONS);
      const causalHistorySize = (channelA as any).causalHistorySize;
      const filterBytes = new Array<Uint8Array>();
      const messages = new Array<string>(causalHistorySize + 5)
        .fill("message")
        .map((message, index) => `${message}-${index}`);

      for (const message of messages) {
        filterBytes.push(bloomFilter.toBytes());
        await sendMessage(channelA, utf8ToBytes(message), callback);
        bloomFilter.insert(MessageChannel.getMessageId(utf8ToBytes(message)));
      }

      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(messages.length);

      outgoingBuffer.forEach((message, index) => {
        expect(message.content).to.deep.equal(utf8ToBytes(messages[index]));
        // Correct bloom filter should be attached to each message
        expect(message.bloomFilter).to.deep.equal(filterBytes[index]);
      });

      // Causal history should only contain the last N messages as defined by causalHistorySize
      const causalHistory = outgoingBuffer[outgoingBuffer.length - 1]
        .causalHistory as HistoryEntry[];
      expect(causalHistory.length).to.equal(causalHistorySize);

      const expectedCausalHistory = messages
        .slice(-causalHistorySize - 1, -1)
        .map((message) => ({
          messageId: MessageChannel.getMessageId(utf8ToBytes(message)),
          retrievalHint: undefined
        }));
      expect(causalHistory).to.deep.equal(expectedCausalHistory);
    });
  });

  describe("receiving a message", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId, "alice");
      channelB = new MessageChannel(channelId, "bob");
    });

    it("should increase lamport timestamp", async () => {
      const timestampBefore = (channelA as any).lamportTimestamp;
      await sendMessage(channelB, utf8ToBytes("message"), async (message) => {
        await receiveMessage(channelA, message);
        return { success: true };
      });
      const timestampAfter = (channelA as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore + 1);
    });

    it("should update lamport timestamp if greater than current timestamp and dependencies are met", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), callback);
      }
      for (const m of messagesB) {
        await sendMessage(channelB, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelA, message);
          return { success: true };
        });
      }
      const timestampAfter = (channelA as any).lamportTimestamp;
      expect(timestampAfter).to.equal(messagesB.length);
    });

    it("should maintain proper timestamps if all messages received", async () => {
      let timestamp = 0;
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          timestamp++;
          await receiveMessage(channelB, message);
          expect((channelB as any).lamportTimestamp).to.equal(timestamp);
          return { success: true };
        });
      }

      for (const m of messagesB) {
        await sendMessage(channelB, utf8ToBytes(m), async (message) => {
          timestamp++;
          await receiveMessage(channelA, message);
          expect((channelA as any).lamportTimestamp).to.equal(timestamp);
          return { success: true };
        });
      }

      const expectedLength = messagesA.length + messagesB.length;
      expect((channelA as any).lamportTimestamp).to.equal(expectedLength);
      expect((channelA as any).lamportTimestamp).to.equal(
        (channelB as any).lamportTimestamp
      );
    });

    it("should add received messages to bloom filter", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelB, message);
          const bloomFilter = getBloomFilter(channelB);
          expect(bloomFilter.lookup(message.messageId)).to.equal(true);
          return { success: true };
        });
      }
    });

    it("should add to incoming buffer if dependencies are not met", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), callback);
      }

      let receivedMessage: Message | null = null;
      const timestampBefore = (channelB as any).lamportTimestamp;

      await sendMessage(
        channelA,
        utf8ToBytes(messagesB[0]),
        async (message) => {
          receivedMessage = message;
          await receiveMessage(channelB, message);
          return { success: true };
        }
      );

      const incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(1);
      expect(incomingBuffer[0].messageId).to.equal(receivedMessage!.messageId);

      // Since the dependency is not met, the lamport timestamp should not increase
      const timestampAfter = (channelB as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore);

      // Message should not be in local history
      const localHistory = (channelB as any).localHistory as {
        timestamp: number;
        historyEntry: HistoryEntry;
      }[];
      expect(
        localHistory.some(
          ({ historyEntry: { messageId } }) =>
            messageId === receivedMessage!.messageId
        )
      ).to.equal(false);
    });
  });

  describe("reviewing ack status", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId, "alice", {
        causalHistorySize: 2
      });
      channelB = new MessageChannel(channelId, "bob", { causalHistorySize: 2 });
    });

    it("should mark all messages in causal history as acknowledged", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelB, message);
          return { success: true };
        });
      }
      await channelA.processTasks();
      await channelB.processTasks();

      await sendMessage(
        channelA,
        utf8ToBytes("not-in-history"),
        async (message) => {
          await receiveMessage(channelB, message);
          return { success: true };
        }
      );
      await channelA.processTasks();
      await channelB.processTasks();

      expect((channelA as any).outgoingBuffer.length).to.equal(
        messagesA.length + 1
      );

      await sendMessage(
        channelB,
        utf8ToBytes(messagesB[0]),
        async (message) => {
          await receiveMessage(channelA, message);
          return { success: true };
        }
      );
      await channelA.processTasks();
      await channelB.processTasks();

      // Channel B only includes the last causalHistorySize messages in its causal history
      // Since B received message-1, message-2, and not-in-history (3 messages),
      // and causalHistorySize is 3, it will only include the last 2 in its causal history
      // So message-1 won't be acknowledged, only message-2 and not-in-history
      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(1);
      // The remaining message should be message-1 (not acknowledged)
      expect(outgoingBuffer[0].messageId).to.equal(
        MessageChannel.getMessageId(utf8ToBytes(messagesA[0]))
      );
    });

    it("should not mark messages in causal history as acknowledged if it's our own message", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelA, message); // same channel used on purpose
          return { success: true };
        });
      }
      await channelA.processTasks();

      // All messages remain in the buffer
      expect((channelA as any).outgoingBuffer.length).to.equal(
        messagesA.length
      );
    });

    it("should track probabilistic acknowledgements of messages received in bloom filter", async () => {
      const possibleAcksThreshold = (channelA as any).possibleAcksThreshold;

      const causalHistorySize = (channelA as any).causalHistorySize;

      const unacknowledgedMessages = [
        "unacknowledged-message-1",
        "unacknowledged-message-2"
      ];
      const messages = [...messagesA, ...messagesB.slice(0, -1)];
      // Send messages to be received by channel B
      for (const m of messages) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelB, message);
          return { success: true };
        });
      }

      // Send messages not received by channel B
      for (const m of unacknowledgedMessages) {
        await sendMessage(channelA, utf8ToBytes(m), callback);
      }

      // Channel B sends a message to channel A
      await sendMessage(
        channelB,
        utf8ToBytes(messagesB[messagesB.length - 1]),
        async (message) => {
          await receiveMessage(channelA, message);
          return { success: true };
        }
      );

      const possibleAcks: ReadonlyMap<MessageId, number> = (channelA as any)
        .possibleAcks;
      // Other than the message IDs which were included in causal history,
      // the remaining messages sent by channel A should be considered possibly acknowledged
      // for having been included in the bloom filter sent from channel B
      const expectedAcknowledgementsSize = messages.length - causalHistorySize;
      if (expectedAcknowledgementsSize <= 0) {
        throw new Error("expectedAcknowledgementsSize must be greater than 0");
      }
      expect(possibleAcks.size).to.equal(expectedAcknowledgementsSize);
      // Channel B only included the last N messages in causal history
      messages.slice(0, -causalHistorySize).forEach((m) => {
        expect(
          possibleAcks.get(MessageChannel.getMessageId(utf8ToBytes(m)))
        ).to.equal(1);
      });

      // Messages that never reached channel B should not be acknowledged
      unacknowledgedMessages.forEach((m) => {
        expect(
          possibleAcks.has(MessageChannel.getMessageId(utf8ToBytes(m)))
        ).to.equal(false);
      });

      // When channel C sends more messages, it will include all the same messages
      // in the bloom filter as before, which should mark them as fully acknowledged in channel A
      for (let i = 1; i < possibleAcksThreshold; i++) {
        // Send messages until acknowledgement count is reached
        await sendMessage(channelB, utf8ToBytes(`x-${i}`), async (message) => {
          await receiveMessage(channelA, message);
          return { success: true };
        });
      }

      // No more possible acknowledgements should be in channel A
      expect(possibleAcks.size).to.equal(0);

      // Messages that were not acknowledged should still be in the outgoing buffer
      expect((channelA as any).outgoingBuffer.length).to.equal(
        unacknowledgedMessages.length
      );
      unacknowledgedMessages.forEach((m) => {
        expect(
          ((channelA as any).outgoingBuffer as Message[]).some(
            (message) =>
              message.messageId === MessageChannel.getMessageId(utf8ToBytes(m))
          )
        ).to.equal(true);
      });
    });

    it("should not track probabilistic acknowledgements of messages received in bloom filter of own messages", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelA, message);
          return { success: true };
        });
      }

      const possibleAcks: ReadonlyMap<MessageId, number> = (channelA as any)
        .possibleAcks;

      expect(possibleAcks.size).to.equal(0);
    });
  });

  describe("Sweeping incoming buffer", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId, "alice", {
        causalHistorySize: 2
      });
      channelB = new MessageChannel(channelId, "bob", { causalHistorySize: 2 });
    });

    it("should detect messages with missing dependencies", async () => {
      const causalHistorySize = (channelA as any).causalHistorySize;
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), callback);
      }

      await sendMessage(
        channelA,
        utf8ToBytes(messagesB[0]),
        async (message) => {
          await receiveMessage(channelB, message);
          return { success: true };
        }
      );

      const incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(1);
      expect(incomingBuffer[0].messageId).to.equal(
        MessageChannel.getMessageId(utf8ToBytes(messagesB[0]))
      );

      const missingMessages = channelB.sweepIncomingBuffer();
      expect(missingMessages.length).to.equal(causalHistorySize);
      expect(missingMessages[0].messageId).to.equal(
        MessageChannel.getMessageId(utf8ToBytes(messagesA[0]))
      );
    });

    it("should deliver messages after dependencies are met", async () => {
      const causalHistorySize = (channelA as any).causalHistorySize;
      const sentMessages = new Array<Message>();
      // First, send messages from A but DON'T deliver them to B yet
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          sentMessages.push(message);
          // Don't receive them at B yet - we want them to be missing dependencies
          return { success: true };
        });
      }
      await channelA.processTasks();

      // Now send a message from A to B that depends on messagesA
      await sendMessage(
        channelA,
        utf8ToBytes(messagesB[0]),
        async (message) => {
          await receiveMessage(channelB, message);
          return { success: true };
        }
      );
      await channelA.processTasks();
      await channelB.processTasks();

      // Message should be in incoming buffer waiting for dependencies
      const missingMessages = channelB.sweepIncomingBuffer();
      expect(missingMessages.length).to.equal(causalHistorySize);
      expect(missingMessages[0].messageId).to.equal(
        MessageChannel.getMessageId(utf8ToBytes(messagesA[0]))
      );

      let incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(1);

      // Now deliver the missing dependencies
      for (const m of sentMessages) {
        await receiveMessage(channelB, m);
      }
      await channelB.processTasks();

      // Sweep should now deliver the waiting message
      const missingMessages2 = channelB.sweepIncomingBuffer();
      expect(missingMessages2.length).to.equal(0);

      incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(0);
    });

    it("should mark a message as irretrievably lost if timeout is exceeded", async () => {
      // Create a channel with very very short timeout
      const channelC: MessageChannel = new MessageChannel(channelId, "carol", {
        timeoutToMarkMessageIrretrievableMs: 10
      });

      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), callback);
      }

      let irretrievablyLost = false;
      const messageToBeLostId = MessageChannel.getMessageId(
        utf8ToBytes(messagesA[0])
      );
      channelC.addEventListener(
        MessageChannelEvent.InMessageIrretrievablyLost,
        (event) => {
          for (const hist of event.detail) {
            if (hist.messageId === messageToBeLostId) {
              irretrievablyLost = true;
            }
          }
        }
      );

      await sendMessage(
        channelA,
        utf8ToBytes(messagesB[0]),
        async (message) => {
          await receiveMessage(channelC, message);
          return { success: true };
        }
      );

      channelC.sweepIncomingBuffer();

      await new Promise((resolve) => setTimeout(resolve, 20));

      channelC.sweepIncomingBuffer();

      expect(irretrievablyLost).to.be.true;
    });

    it("should remove messages without delivering if timeout is exceeded", async () => {
      const causalHistorySize = (channelA as any).causalHistorySize;
      // Create a channel with very very short timeout
      const channelC: MessageChannel = new MessageChannel(channelId, "carol", {
        timeoutToMarkMessageIrretrievableMs: 10
      });

      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), callback);
      }

      await sendMessage(
        channelA,
        utf8ToBytes(messagesB[0]),
        async (message) => {
          await receiveMessage(channelC, message);
          return { success: true };
        }
      );

      const missingMessages = channelC.sweepIncomingBuffer();
      expect(missingMessages.length).to.equal(causalHistorySize);
      let incomingBuffer = (channelC as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(1);

      await new Promise((resolve) => setTimeout(resolve, 20));

      channelC.sweepIncomingBuffer();
      incomingBuffer = (channelC as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(0);
    });
  });

  describe("Sweeping outgoing buffer", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId, "alice", {
        causalHistorySize: 2
      });
      channelB = new MessageChannel(channelId, "bob", { causalHistorySize: 2 });
    });

    it("should partition messages based on acknowledgement status", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelB, message);
          return { success: true };
        });
      }

      let { unacknowledged, possiblyAcknowledged } =
        channelA.sweepOutgoingBuffer();
      expect(unacknowledged.length).to.equal(messagesA.length);
      expect(possiblyAcknowledged.length).to.equal(0);

      // Make sure messages sent by channel A are not in causal history
      const causalHistorySize = (channelA as any).causalHistorySize;
      for (const m of messagesB.slice(0, causalHistorySize)) {
        await sendMessage(channelB, utf8ToBytes(m), callback);
      }

      await sendMessage(
        channelB,
        utf8ToBytes(messagesB[causalHistorySize]),
        async (message) => {
          await receiveMessage(channelA, message);
          return { success: true };
        }
      );

      // All messages that were previously unacknowledged should now be possibly acknowledged
      // since they were included in one of the bloom filters sent from channel B
      ({ unacknowledged, possiblyAcknowledged } =
        channelA.sweepOutgoingBuffer());
      expect(unacknowledged.length).to.equal(0);
      expect(possiblyAcknowledged.length).to.equal(messagesA.length);
    });
  });

  describe("Sync messages", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId, "alice", {
        causalHistorySize: 2
      });
      channelB = new MessageChannel(channelId, "bob", { causalHistorySize: 2 });
    });

    it("should be sent with empty content", async () => {
      await channelA.pushOutgoingSyncMessage(async (message) => {
        expect(message.content?.length).to.equal(0);
        return true;
      });
    });

    it("should not be added to outgoing buffer, bloom filter, or local log", async () => {
      await channelA.pushOutgoingSyncMessage();

      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(0);

      const bloomFilter = getBloomFilter(channelA);
      expect(
        bloomFilter.lookup(MessageChannel.getMessageId(new Uint8Array()))
      ).to.equal(false);

      const localLog = (channelA as any).localHistory as {
        timestamp: number;
        messageId: MessageId;
      }[];
      expect(localLog.length).to.equal(0);
    });

    it("should not be delivered", async () => {
      const timestampBefore = (channelB as any).lamportTimestamp;
      await channelA.pushOutgoingSyncMessage(async (message) => {
        await receiveMessage(channelB, message);
        return true;
      });
      const timestampAfter = (channelB as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore);

      const localLog = (channelB as any).localHistory as {
        timestamp: number;
        messageId: MessageId;
      }[];
      expect(localLog.length).to.equal(0);

      const bloomFilter = getBloomFilter(channelB);
      expect(
        bloomFilter.lookup(MessageChannel.getMessageId(new Uint8Array()))
      ).to.equal(false);
    });

    it("should update ack status of messages in outgoing buffer", async () => {
      for (const m of messagesA) {
        await sendMessage(channelA, utf8ToBytes(m), async (message) => {
          await receiveMessage(channelB, message);
          return { success: true };
        });
      }

      await sendMessage(channelB, new Uint8Array(), async (message) => {
        await receiveMessage(channelA, message);
        return { success: true };
      });

      const causalHistorySize = (channelA as any).causalHistorySize;
      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(
        messagesA.length - causalHistorySize
      );
    });
  });

  describe("Ephemeral messages", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId, "alice");
    });

    it("should be sent without a timestamp, causal history, or bloom filter", async () => {
      const timestampBefore = (channelA as any).lamportTimestamp;
      await channelA.pushOutgoingEphemeralMessage(
        new Uint8Array(),
        async (message) => {
          expect(message.lamportTimestamp).to.equal(undefined);
          expect(message.causalHistory).to.deep.equal([]);
          expect(message.bloomFilter).to.equal(undefined);
          return true;
        }
      );

      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(0);

      const timestampAfter = (channelA as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore);
    });

    it("should be delivered immediately if received", async () => {
      const channelB = new MessageChannel(channelId, "bob");

      // Track initial state
      const localHistoryBefore = (channelB as any).localHistory.length;
      const incomingBufferBefore = (channelB as any).incomingBuffer.length;
      const timestampBefore = (channelB as any).lamportTimestamp;

      await channelA.pushOutgoingEphemeralMessage(
        utf8ToBytes(messagesA[0]),
        async (message) => {
          // Ephemeral messages should have no timestamp
          expect(message.lamportTimestamp).to.be.undefined;
          await receiveMessage(channelB, message);
          return true;
        }
      );
      await channelA.processTasks();
      await channelB.processTasks();

      // Verify ephemeral message behavior:
      // 1. Not added to local history
      expect((channelB as any).localHistory.length).to.equal(
        localHistoryBefore
      );
      // 2. Not added to incoming buffer
      expect((channelB as any).incomingBuffer.length).to.equal(
        incomingBufferBefore
      );
      // 3. Doesn't update lamport timestamp
      expect((channelB as any).lamportTimestamp).to.equal(timestampBefore);
    });
  });
});
