import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { DefaultBloomFilter } from "./bloom.js";
import {
  DEFAULT_BLOOM_FILTER_OPTIONS,
  Message,
  MessageChannel
} from "./sds.js";

const channelId = "test-channel";
const callback = (_message: Message): Promise<boolean> => {
  return Promise.resolve(true);
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

describe("MessageChannel", function () {
  this.timeout(5000);
  let channelA: MessageChannel;
  let channelB: MessageChannel;

  describe("sending a message ", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId);
    });

    it("should increase lamport timestamp", async () => {
      const timestampBefore = (channelA as any).lamportTimestamp;
      await channelA.sendMessage(new Uint8Array(), callback);
      const timestampAfter = (channelA as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore + 1);
    });

    it("should push the message to the outgoing buffer", async () => {
      const bufferLengthBefore = (channelA as any).outgoingBuffer.length;
      await channelA.sendMessage(new Uint8Array(), callback);
      const bufferLengthAfter = (channelA as any).outgoingBuffer.length;
      expect(bufferLengthAfter).to.equal(bufferLengthBefore + 1);
    });

    it("should insert message into bloom filter", async () => {
      const messageId = MessageChannel.getMessageId(new Uint8Array());
      await channelA.sendMessage(new Uint8Array(), callback);
      const bloomFilter = getBloomFilter(channelA);
      expect(bloomFilter.lookup(messageId)).to.equal(true);
    });

    it("should insert message id into causal history", async () => {
      const expectedTimestamp = (channelA as any).lamportTimestamp + 1;
      const messageId = MessageChannel.getMessageId(new Uint8Array());
      await channelA.sendMessage(new Uint8Array(), callback);
      const messageIdLog = (channelA as any).messageIdLog as {
        timestamp: number;
        messageId: string;
      }[];
      expect(messageIdLog.length).to.equal(1);
      expect(
        messageIdLog.some(
          (log) =>
            log.timestamp === expectedTimestamp && log.messageId === messageId
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
        await channelA.sendMessage(utf8ToBytes(message), callback);
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
        .causalHistory as string[];
      expect(causalHistory.length).to.equal(causalHistorySize);

      const expectedCausalHistory = messages
        .slice(-causalHistorySize - 1, -1)
        .map((message) => MessageChannel.getMessageId(utf8ToBytes(message)));
      expect(causalHistory).to.deep.equal(expectedCausalHistory);
    });
  });

  describe("receiving a message", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId);
      channelB = new MessageChannel(channelId);
    });

    it("should increase lamport timestamp", async () => {
      const timestampBefore = (channelA as any).lamportTimestamp;
      await channelB.sendMessage(new Uint8Array(), (message) => {
        channelA.receiveMessage(message);
        return Promise.resolve(true);
      });
      const timestampAfter = (channelA as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore + 1);
    });

    it("should update lamport timestamp if greater than current timestamp and dependencies are met", async () => {
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), callback);
      }
      for (const m of messagesB) {
        await channelB.sendMessage(utf8ToBytes(m), (message) => {
          channelA.receiveMessage(message);
          return Promise.resolve(true);
        });
      }
      const timestampAfter = (channelA as any).lamportTimestamp;
      expect(timestampAfter).to.equal(messagesB.length);
    });

    it("should maintain proper timestamps if all messages received", async () => {
      let timestamp = 0;
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), (message) => {
          timestamp++;
          channelB.receiveMessage(message);
          expect((channelB as any).lamportTimestamp).to.equal(timestamp);
          return Promise.resolve(true);
        });
      }

      for (const m of messagesB) {
        await channelB.sendMessage(utf8ToBytes(m), (message) => {
          timestamp++;
          channelA.receiveMessage(message);
          expect((channelA as any).lamportTimestamp).to.equal(timestamp);
          return Promise.resolve(true);
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
        await channelA.sendMessage(utf8ToBytes(m), (message) => {
          channelB.receiveMessage(message);
          const bloomFilter = getBloomFilter(channelB);
          expect(bloomFilter.lookup(message.messageId)).to.equal(true);
          return Promise.resolve(true);
        });
      }
    });

    it("should add to incoming buffer if dependencies are not met", async () => {
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), callback);
      }

      let receivedMessage: Message | null = null;
      const timestampBefore = (channelB as any).lamportTimestamp;

      await channelA.sendMessage(utf8ToBytes(messagesB[0]), (message) => {
        receivedMessage = message;
        channelB.receiveMessage(message);
        return Promise.resolve(true);
      });

      const incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(1);
      expect(incomingBuffer[0].messageId).to.equal(receivedMessage!.messageId);

      // Since the dependency is not met, the lamport timestamp should not increase
      const timestampAfter = (channelB as any).lamportTimestamp;
      expect(timestampAfter).to.equal(timestampBefore);

      // Message should not be in local history
      const localHistory = (channelB as any).messageIdLog as {
        timestamp: number;
        messageId: string;
      }[];
      expect(
        localHistory.some((m) => m.messageId === receivedMessage!.messageId)
      ).to.equal(false);
    });
  });

  describe("reviewing ack status", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId);
      channelB = new MessageChannel(channelId);
    });

    it("should mark all messages in causal history as acknowledged", async () => {
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), (message) => {
          channelB.receiveMessage(message);
          return Promise.resolve(true);
        });
      }

      let notInHistory: Message | null = null;
      await channelA.sendMessage(utf8ToBytes("not-in-history"), (message) => {
        notInHistory = message;
        return Promise.resolve(true);
      });

      expect((channelA as any).outgoingBuffer.length).to.equal(
        messagesA.length + 1
      );

      await channelB.sendMessage(utf8ToBytes(messagesB[0]), (message) => {
        channelA.receiveMessage(message);
        return Promise.resolve(true);
      });

      // Since messagesA are in causal history of channel B's message
      // they should be gone from channel A's outgoing buffer
      // and notInHistory should still be in the outgoing buffer
      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(1);
      expect(outgoingBuffer[0].messageId).to.equal(notInHistory!.messageId);
    });

    it("should track probabilistic acknowledgements of messages received in bloom filter", async () => {
      const acknowledgementCount = (channelA as any).acknowledgementCount;

      const causalHistorySize = (channelA as any).causalHistorySize;

      const unacknowledgedMessages = [
        "unacknowledged-message-1",
        "unacknowledged-message-2"
      ];
      const messages = [...messagesA, ...messagesB.slice(0, -1)];
      // Send messages to be received by channel B
      for (const m of messages) {
        await channelA.sendMessage(utf8ToBytes(m), (message) => {
          channelB.receiveMessage(message);
          return Promise.resolve(true);
        });
      }

      // Send messages not received by channel B
      for (const m of unacknowledgedMessages) {
        await channelA.sendMessage(utf8ToBytes(m), callback);
      }

      // Channel B sends a message to channel A
      await channelB.sendMessage(
        utf8ToBytes(messagesB[messagesB.length - 1]),
        (message) => {
          channelA.receiveMessage(message);
          return Promise.resolve(true);
        }
      );

      const acknowledgements: ReadonlyMap<string, number> = (channelA as any)
        .acknowledgements;
      // Other than the message IDs which were included in causal history,
      // the remaining messages sent by channel A should be considered possibly acknowledged
      // for having been included in the bloom filter sent from channel B
      const expectedAcknowledgementsSize = messages.length - causalHistorySize;
      if (expectedAcknowledgementsSize <= 0) {
        throw new Error("expectedAcknowledgementsSize must be greater than 0");
      }
      expect(acknowledgements.size).to.equal(expectedAcknowledgementsSize);
      // Channel B only included the last N messages in causal history
      messages.slice(0, -causalHistorySize).forEach((m) => {
        expect(
          acknowledgements.get(MessageChannel.getMessageId(utf8ToBytes(m)))
        ).to.equal(1);
      });

      // Messages that never reached channel B should not be acknowledged
      unacknowledgedMessages.forEach((m) => {
        expect(
          acknowledgements.has(MessageChannel.getMessageId(utf8ToBytes(m)))
        ).to.equal(false);
      });

      // When channel C sends more messages, it will include all the same messages
      // in the bloom filter as before, which should mark them as fully acknowledged in channel A
      for (let i = 1; i < acknowledgementCount; i++) {
        // Send messages until acknowledgement count is reached
        await channelB.sendMessage(utf8ToBytes(`x-${i}`), (message) => {
          channelA.receiveMessage(message);
          return Promise.resolve(true);
        });
      }

      // No more partial acknowledgements should be in channel A
      expect(acknowledgements.size).to.equal(0);

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
  });

  describe("Sweeping incoming buffer", () => {
    beforeEach(() => {
      channelA = new MessageChannel(channelId);
      channelB = new MessageChannel(channelId);
    });

    it("should detect messages with missing dependencies", async () => {
      const causalHistorySize = (channelA as any).causalHistorySize;
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), callback);
      }

      await channelA.sendMessage(utf8ToBytes(messagesB[0]), (message) => {
        channelB.receiveMessage(message);
        return Promise.resolve(true);
      });

      const incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(1);
      expect(incomingBuffer[0].messageId).to.equal(
        MessageChannel.getMessageId(utf8ToBytes(messagesB[0]))
      );

      const missingMessages = channelB.sweepIncomingBuffer();
      expect(missingMessages.length).to.equal(causalHistorySize);
      expect(missingMessages[0]).to.equal(
        MessageChannel.getMessageId(utf8ToBytes(messagesA[0]))
      );
    });

    it("should deliver messages after dependencies are met", async () => {
      const causalHistorySize = (channelA as any).causalHistorySize;
      const sentMessages = new Array<Message>();
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), (message) => {
          sentMessages.push(message);
          return Promise.resolve(true);
        });
      }

      await channelA.sendMessage(utf8ToBytes(messagesB[0]), (message) => {
        channelB.receiveMessage(message);
        return Promise.resolve(true);
      });

      const missingMessages = channelB.sweepIncomingBuffer();
      expect(missingMessages.length).to.equal(causalHistorySize);
      expect(missingMessages[0]).to.equal(
        MessageChannel.getMessageId(utf8ToBytes(messagesA[0]))
      );

      let incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(1);

      sentMessages.forEach((m) => {
        channelB.receiveMessage(m);
      });

      const missingMessages2 = channelB.sweepIncomingBuffer();
      expect(missingMessages2.length).to.equal(0);

      incomingBuffer = (channelB as any).incomingBuffer as Message[];
      expect(incomingBuffer.length).to.equal(0);
    });

    it("should remove messages without delivering if timeout is exceeded", async () => {
      const causalHistorySize = (channelA as any).causalHistorySize;
      // Create a channel with very very short timeout
      const channelC: MessageChannel = new MessageChannel(
        channelId,
        causalHistorySize,
        true,
        10
      );

      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), callback);
      }

      await channelA.sendMessage(utf8ToBytes(messagesB[0]), (message) => {
        channelC.receiveMessage(message);
        return Promise.resolve(true);
      });

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
      channelA = new MessageChannel(channelId);
      channelB = new MessageChannel(channelId);
    });

    it("should partition messages based on acknowledgement status", async () => {
      const unacknowledgedMessages: Message[] = [];
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), (message) => {
          unacknowledgedMessages.push(message);
          channelB.receiveMessage(message);
          return Promise.resolve(true);
        });
      }

      let { unacknowledged, possiblyAcknowledged } =
        channelA.sweepOutgoingBuffer();
      expect(unacknowledged.length).to.equal(messagesA.length);
      expect(possiblyAcknowledged.length).to.equal(0);

      // Make sure messages sent by channel A are not in causal history
      const causalHistorySize = (channelA as any).causalHistorySize;
      for (const m of messagesB.slice(0, causalHistorySize)) {
        await channelB.sendMessage(utf8ToBytes(m), callback);
      }

      await channelB.sendMessage(
        utf8ToBytes(messagesB[causalHistorySize]),
        (message) => {
          channelA.receiveMessage(message);
          return Promise.resolve(true);
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
      channelA = new MessageChannel(channelId);
      channelB = new MessageChannel(channelId);
    });

    it("should be sent with empty content", async () => {
      await channelA.sendSyncMessage((message) => {
        expect(message.content?.length).to.equal(0);
        return Promise.resolve(true);
      });
    });

    it("should not be added to outgoing buffer, bloom filter, or local log", async () => {
      await channelA.sendSyncMessage();

      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(0);

      const bloomFilter = getBloomFilter(channelA);
      expect(
        bloomFilter.lookup(MessageChannel.getMessageId(new Uint8Array()))
      ).to.equal(false);

      const localLog = (channelA as any).messageIdLog as {
        timestamp: number;
        messageId: string;
      }[];
      expect(localLog.length).to.equal(0);
    });

    it("should be delivered but not added to local log or bloom filter", async () => {
      const timestampBefore = (channelB as any).lamportTimestamp;
      let expectedTimestamp: number | undefined;
      await channelA.sendSyncMessage((message) => {
        expectedTimestamp = message.lamportTimestamp;
        channelB.receiveMessage(message);
        return Promise.resolve(true);
      });
      const timestampAfter = (channelB as any).lamportTimestamp;
      expect(timestampAfter).to.equal(expectedTimestamp);
      expect(timestampAfter).to.be.greaterThan(timestampBefore);

      const localLog = (channelB as any).messageIdLog as {
        timestamp: number;
        messageId: string;
      }[];
      expect(localLog.length).to.equal(0);

      const bloomFilter = getBloomFilter(channelB);
      expect(
        bloomFilter.lookup(MessageChannel.getMessageId(new Uint8Array()))
      ).to.equal(false);
    });

    it("should update ack status of messages in outgoing buffer", async () => {
      for (const m of messagesA) {
        await channelA.sendMessage(utf8ToBytes(m), (message) => {
          channelB.receiveMessage(message);
          return Promise.resolve(true);
        });
      }

      await channelB.sendSyncMessage((message) => {
        channelA.receiveMessage(message);
        return Promise.resolve(true);
      });

      const causalHistorySize = (channelA as any).causalHistorySize;
      const outgoingBuffer = (channelA as any).outgoingBuffer as Message[];
      expect(outgoingBuffer.length).to.equal(
        messagesA.length - causalHistorySize
      );
    });
  });
});
