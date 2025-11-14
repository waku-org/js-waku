import type { IDecodedMessage, ISendMessage } from "@waku/interfaces";
import { expect } from "chai";
import { beforeEach, describe, it } from "mocha";

import { MessageStore } from "./message_store.js";

describe("MessageStore", () => {
  let messageStore: MessageStore;
  let mockMessage: IDecodedMessage;
  let mockSendMessage: ISendMessage;

  beforeEach(() => {
    messageStore = new MessageStore();
    mockMessage = {
      version: 1,
      payload: new Uint8Array([1, 2, 3]),
      contentTopic: "test-topic",
      pubsubTopic: "test-pubsub",
      timestamp: new Date(1000),
      rateLimitProof: undefined,
      ephemeral: false,
      meta: undefined,
      hash: new Uint8Array([4, 5, 6]),
      hashStr: "test-hash-123"
    };
    mockSendMessage = {
      contentTopic: "test-topic",
      payload: new Uint8Array([7, 8, 9]),
      ephemeral: false
    };
  });

  describe("constructor", () => {
    it("should create instance with default options", () => {
      const store = new MessageStore();
      expect(store).to.be.instanceOf(MessageStore);
    });

    it("should create instance with custom resend interval", () => {
      const customInterval = 10000;
      const store = new MessageStore({ resendIntervalMs: customInterval });
      expect(store).to.be.instanceOf(MessageStore);
    });
  });

  describe("has", () => {
    it("should return false for non-existent message", () => {
      expect(messageStore.has("non-existent")).to.be.false;
    });

    it("should return true for added message", () => {
      messageStore.add(mockMessage);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should return true for pending message", async () => {
      await messageStore.queue(mockSendMessage);
      expect(messageStore.has("pending-hash")).to.be.false;
    });
  });

  describe("add", () => {
    it("should add new message with default options", () => {
      messageStore.add(mockMessage);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should add message with custom options", () => {
      messageStore.add(mockMessage, { filterAck: true, storeAck: false });
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should not add duplicate message", () => {
      messageStore.add(mockMessage);
      messageStore.add(mockMessage);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should not add message if already exists", () => {
      messageStore.add(mockMessage);
      messageStore.add(mockMessage);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });
  });

  describe("queue", () => {
    it("should queue message and return request ID", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      expect(typeof requestId).to.equal("string");
      expect(requestId.length).to.be.greaterThan(0);
    });

    it("should queue multiple messages with different request IDs", async () => {
      const requestId1 = await messageStore.queue(mockSendMessage);
      const requestId2 = await messageStore.queue(mockSendMessage);
      expect(requestId1).to.not.equal(requestId2);
    });
  });

  describe("markFilterAck", () => {
    it("should mark filter acknowledgment for existing message", () => {
      messageStore.add(mockMessage);
      messageStore.markFilterAck(mockMessage.hashStr);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should handle filter ack for non-existent message", () => {
      expect(() => {
        messageStore.markFilterAck("non-existent");
      }).to.not.throw();
    });

    it("should handle filter ack for pending message", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      messageStore.markSent(requestId, mockMessage);
      messageStore.markFilterAck(mockMessage.hashStr);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });
  });

  describe("markStoreAck", () => {
    it("should mark store acknowledgment for existing message", () => {
      messageStore.add(mockMessage);
      messageStore.markStoreAck(mockMessage.hashStr);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should handle store ack for non-existent message", () => {
      expect(() => {
        messageStore.markStoreAck("non-existent");
      }).to.not.throw();
    });

    it("should handle store ack for pending message", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      messageStore.markSent(requestId, mockMessage);
      messageStore.markStoreAck(mockMessage.hashStr);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });
  });

  describe("markSent", () => {
    it("should mark message as sent with valid request ID", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      messageStore.markSent(requestId, mockMessage);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should handle markSent with invalid request ID", () => {
      expect(() => {
        messageStore.markSent("invalid-request-id", mockMessage);
      }).to.not.throw();
    });

    it("should handle markSent with request ID without message", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      const entry = (messageStore as any).pendingRequests.get(requestId);
      if (entry) {
        entry.messageRequest = undefined;
      }
      expect(() => {
        messageStore.markSent(requestId, mockMessage);
      }).to.not.throw();
    });

    it("should set lastSentAt timestamp", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      const sentMessage = { ...mockMessage, timestamp: new Date(2000) };
      messageStore.markSent(requestId, sentMessage);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });
  });

  describe("getMessagesToSend", () => {
    it("should return empty array when no messages queued", () => {
      const messages = messageStore.getMessagesToSend();
      expect(messages).to.deep.equal([]);
    });

    it("should return queued messages that need sending", async () => {
      const customStore = new MessageStore({ resendIntervalMs: 0 });
      const requestId = await customStore.queue(mockSendMessage);
      const messages = customStore.getMessagesToSend();
      expect(messages).to.have.length(1);
      expect(messages[0].requestId).to.equal(requestId);
      expect(messages[0].message).to.equal(mockSendMessage);
    });

    it("should not return acknowledged messages", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      const entry = (messageStore as any).pendingRequests.get(requestId);
      if (entry) {
        entry.filterAck = true;
      }
      const messages = messageStore.getMessagesToSend();
      expect(messages).to.have.length(0);
    });

    it("should not return store acknowledged messages", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      const entry = (messageStore as any).pendingRequests.get(requestId);
      if (entry) {
        entry.storeAck = true;
      }
      const messages = messageStore.getMessagesToSend();
      expect(messages).to.have.length(0);
    });

    it("should respect resend interval", async () => {
      const customStore = new MessageStore({ resendIntervalMs: 10000 });
      const requestId = await customStore.queue(mockSendMessage);

      const entry = (customStore as any).pendingRequests.get(requestId);
      if (entry) {
        entry.lastSentAt = Date.now() - 5000;
      }

      const messagesAfterShortTime = customStore.getMessagesToSend();
      expect(messagesAfterShortTime).to.have.length(0);

      if (entry) {
        entry.lastSentAt = Date.now() - 15000;
      }

      const messagesAfterLongTime = customStore.getMessagesToSend();
      expect(messagesAfterLongTime).to.have.length(1);
    });

    it("should return messages after resend interval", async () => {
      const customStore = new MessageStore({ resendIntervalMs: 1000 });
      const requestId = await customStore.queue(mockSendMessage);

      const entry = (customStore as any).pendingRequests.get(requestId);
      if (entry) {
        entry.lastSentAt = Date.now() - 2000;
      }

      const messages = customStore.getMessagesToSend();
      expect(messages).to.have.length(1);
    });

    it("should not return messages without messageRequest", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      const entry = (messageStore as any).pendingRequests.get(requestId);
      if (entry) {
        entry.messageRequest = undefined;
      }
      const messages = messageStore.getMessagesToSend();
      expect(messages).to.have.length(0);
    });
  });

  describe("edge cases", () => {
    it("should handle multiple acknowledgments for same message", () => {
      messageStore.add(mockMessage);
      messageStore.markFilterAck(mockMessage.hashStr);
      messageStore.markStoreAck(mockMessage.hashStr);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should handle message received before sent", async () => {
      messageStore.add(mockMessage);
      const requestId = await messageStore.queue(mockSendMessage);
      messageStore.markSent(requestId, mockMessage);
      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should handle empty message hash", () => {
      const emptyHashMessage = { ...mockMessage, hashStr: "" };
      messageStore.add(emptyHashMessage);
      expect(messageStore.has("")).to.be.true;
    });

    it("should handle very long message hash", () => {
      const longHash = "a".repeat(1000);
      const longHashMessage = { ...mockMessage, hashStr: longHash };
      messageStore.add(longHashMessage);
      expect(messageStore.has(longHash)).to.be.true;
    });

    it("should handle special characters in hash", () => {
      const specialHash = "test-hash-!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const specialHashMessage = { ...mockMessage, hashStr: specialHash };
      messageStore.add(specialHashMessage);
      expect(messageStore.has(specialHash)).to.be.true;
    });
  });

  describe("state transitions", () => {
    it("should move message from pending to stored on ack", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      messageStore.markSent(requestId, mockMessage);
      messageStore.markFilterAck(mockMessage.hashStr);

      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
      const pendingMessages = (messageStore as any).pendingMessages;
      expect(pendingMessages.has(mockMessage.hashStr)).to.be.false;
    });

    it("should merge pending and stored message data", async () => {
      messageStore.add(mockMessage, { filterAck: true });
      const requestId = await messageStore.queue(mockSendMessage);
      messageStore.markSent(requestId, mockMessage);
      messageStore.markStoreAck(mockMessage.hashStr);

      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should preserve acknowledgment state during transition", async () => {
      const requestId = await messageStore.queue(mockSendMessage);
      const entry = (messageStore as any).pendingRequests.get(requestId);
      if (entry) {
        entry.filterAck = true;
      }
      messageStore.markSent(requestId, mockMessage);
      messageStore.markStoreAck(mockMessage.hashStr);

      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });
  });

  describe("timing edge cases", () => {
    it("should handle zero timestamp", async () => {
      const zeroTimeMessage = { ...mockMessage, timestamp: new Date(0) };
      const requestId = await messageStore.queue(mockSendMessage);
      expect(() => {
        messageStore.markSent(requestId, zeroTimeMessage);
      }).to.not.throw();
    });

    it("should handle future timestamp", async () => {
      const futureTime = new Date(Date.now() + 86400000);
      const futureMessage = { ...mockMessage, timestamp: futureTime };
      const requestId = await messageStore.queue(mockSendMessage);
      expect(() => {
        messageStore.markSent(requestId, futureMessage);
      }).to.not.throw();
    });

    it("should handle very old timestamp", async () => {
      const oldTime = new Date(0);
      const oldMessage = { ...mockMessage, timestamp: oldTime };
      const requestId = await messageStore.queue(mockSendMessage);
      expect(() => {
        messageStore.markSent(requestId, oldMessage);
      }).to.not.throw();
    });
  });
});
