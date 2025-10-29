import type { ILightPush, ISendMessage, NetworkConfig } from "@waku/interfaces";
import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import sinon from "sinon";

import type { AckManager } from "./ack_manager.js";
import type { MessageStore } from "./message_store.js";
import { Sender } from "./sender.js";

describe("Sender", () => {
  let sender: Sender;
  let mockMessageStore: MessageStore;
  let mockLightPush: ILightPush;
  let mockAckManager: AckManager;
  let mockNetworkConfig: NetworkConfig;

  beforeEach(() => {
    mockMessageStore = {
      queue: sinon.stub(),
      getMessagesToSend: sinon.stub(),
      markSent: sinon.stub()
    } as any;

    mockLightPush = {
      send: sinon.stub()
    } as any;

    mockAckManager = {
      subscribe: sinon.stub()
    } as any;

    mockNetworkConfig = {
      clusterId: 1,
      shardId: 0
    } as any;

    sender = new Sender({
      messageStore: mockMessageStore,
      lightPush: mockLightPush,
      ackManager: mockAckManager,
      networkConfig: mockNetworkConfig
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with provided parameters", () => {
      expect(sender).to.be.instanceOf(Sender);
    });
  });

  describe("start", () => {
    it("should set up background sending interval", () => {
      const setIntervalSpy = sinon.spy(global, "setInterval");

      sender.start();

      expect(setIntervalSpy.calledWith(sinon.match.func, 1000)).to.be.true;
    });

    it("should not create multiple intervals when called multiple times", () => {
      const setIntervalSpy = sinon.spy(global, "setInterval");

      sender.start();
      sender.start();

      expect(setIntervalSpy.calledOnce).to.be.true;
    });
  });

  describe("stop", () => {
    it("should clear interval when called", () => {
      const clearIntervalSpy = sinon.spy(global, "clearInterval");

      sender.start();
      sender.stop();

      expect(clearIntervalSpy.called).to.be.true;
    });

    it("should handle multiple stop calls gracefully", () => {
      const clearIntervalSpy = sinon.spy(global, "clearInterval");

      sender.start();
      sender.stop();
      sender.stop();

      expect(clearIntervalSpy.calledOnce).to.be.true;
    });

    it("should handle stop without start", () => {
      expect(() => sender.stop()).to.not.throw();
    });
  });

  describe("send", () => {
    const mockMessage: ISendMessage = {
      contentTopic: "test-topic",
      payload: new Uint8Array([1, 2, 3]),
      ephemeral: false
    };

    const mockRequestId = "test-request-id";

    it("should handle messageStore.queue failure", async () => {
      const error = new Error("Queue failed");
      (mockMessageStore.queue as sinon.SinonStub).rejects(error);

      try {
        await sender.send(mockMessage);
        expect.fail("Expected error to be thrown");
      } catch (e: any) {
        expect(e).to.equal(error);
      }
    });

    it("should handle ackManager.subscribe failure", async () => {
      const error = new Error("Subscribe failed");
      (mockAckManager.subscribe as sinon.SinonStub).rejects(error);
      (mockMessageStore.queue as sinon.SinonStub).resolves(mockRequestId);

      try {
        await sender.send(mockMessage);
        expect.fail("Expected error to be thrown");
      } catch (e: any) {
        expect(e).to.equal(error);
      }
    });
  });

  describe("backgroundSend", () => {
    it("should handle empty pending messages", async () => {
      (mockMessageStore.getMessagesToSend as sinon.SinonStub).returns([]);

      await sender["backgroundSend"]();

      expect((mockMessageStore.getMessagesToSend as sinon.SinonStub).called).to
        .be.true;
    });
  });
});
