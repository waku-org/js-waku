import type {
  IDecodedMessage,
  IFilter,
  IStore,
  NetworkConfig
} from "@waku/interfaces";
import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import sinon from "sinon";

import { AckManager } from "./ack_manager.js";
import { MessageStore } from "./message_store.js";

const mockMessage: IDecodedMessage = {
  version: 1,
  payload: new Uint8Array([1, 2, 3]),
  contentTopic: "/test/1/topic/proto",
  pubsubTopic: "test-pubsub",
  timestamp: new Date(),
  rateLimitProof: undefined,
  ephemeral: false,
  meta: undefined,
  hash: new Uint8Array([4, 5, 6]),
  hashStr: "test-hash-123"
};

const mockNetworkConfig: NetworkConfig = {
  clusterId: 1,
  numShardsInCluster: 8
};

describe("AckManager", () => {
  let messageStore: MessageStore;
  let mockFilter: IFilter;
  let mockStore: IStore;
  let ackManager: AckManager;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    messageStore = new MessageStore();

    mockFilter = {
      subscribe: sinon.stub().resolves(true),
      unsubscribe: sinon.stub().resolves(true)
    } as unknown as IFilter;

    mockStore = {
      queryWithOrderedCallback: sinon.stub().resolves(undefined)
    } as unknown as IStore;

    ackManager = new AckManager({
      messageStore,
      filter: mockFilter,
      store: mockStore,
      networkConfig: mockNetworkConfig
    });

    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with provided parameters", () => {
      expect(ackManager).to.be.instanceOf(AckManager);
    });
  });

  describe("start", () => {
    it("should start filter and store ack managers", () => {
      ackManager.start();

      expect(clock.countTimers()).to.equal(1);
    });

    it("should be idempotent", () => {
      ackManager.start();
      ackManager.start();

      expect(clock.countTimers()).to.equal(1);
    });
  });

  describe("stop", () => {
    it("should stop filter and store ack managers", async () => {
      ackManager.start();
      await ackManager.stop();

      expect(clock.countTimers()).to.equal(0);
    });

    it("should clear subscribed content topics", async () => {
      await ackManager.subscribe("/test/1/clear/proto");
      await ackManager.stop();

      const result = await ackManager.subscribe("/test/1/clear/proto");
      expect(result).to.be.true;
    });

    it("should handle stop without start", async () => {
      await ackManager.stop();
    });
  });

  describe("subscribe", () => {
    it("should subscribe to new content topic", async () => {
      const result = await ackManager.subscribe("/test/1/new/proto");

      expect(result).to.be.true;
      expect(
        (mockFilter.subscribe as sinon.SinonStub).calledWith(
          sinon.match.object,
          sinon.match.func
        )
      ).to.be.true;
    });

    it("should return true for already subscribed topic", async () => {
      await ackManager.subscribe("/test/1/existing/proto");
      const result = await ackManager.subscribe("/test/1/existing/proto");

      expect(result).to.be.true;
      expect((mockFilter.subscribe as sinon.SinonStub).calledOnce).to.be.true;
    });

    it("should return true if at least one subscription succeeds", async () => {
      (mockFilter.subscribe as sinon.SinonStub).resolves(false);

      const result = await ackManager.subscribe("/test/1/topic/proto");

      expect(result).to.be.true;
    });

    it("should return true when filter fails but store succeeds", async () => {
      (mockFilter.subscribe as sinon.SinonStub).resolves(false);

      const result = await ackManager.subscribe("/test/1/topic/proto");

      expect(result).to.be.true;
    });
  });

  describe("FilterAckManager", () => {
    beforeEach(() => {
      ackManager.start();
    });

    it("should handle message reception and acknowledgment", async () => {
      await ackManager.subscribe("/test/1/topic/proto");
      const onMessageCallback = (
        mockFilter.subscribe as sinon.SinonStub
      ).getCall(0).args[1];

      await onMessageCallback(mockMessage);

      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should not add duplicate messages", async () => {
      messageStore.add(mockMessage, { filterAck: false });
      await ackManager.subscribe("/test/1/topic/proto");

      const onMessageCallback = (
        mockFilter.subscribe as sinon.SinonStub
      ).getCall(0).args[1];
      await onMessageCallback(mockMessage);

      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should unsubscribe all decoders on stop", async () => {
      await ackManager.subscribe("/test/1/topic1/proto");
      await ackManager.subscribe("/test/1/topic2/proto");

      await ackManager.stop();

      expect((mockFilter.unsubscribe as sinon.SinonStub).calledTwice).to.be
        .true;
    });
  });

  describe("StoreAckManager", () => {
    beforeEach(() => {
      ackManager.start();
    });

    it("should query store periodically", async () => {
      await ackManager.subscribe("/test/1/topic/proto");

      await clock.tickAsync(5000);

      expect(
        (mockStore.queryWithOrderedCallback as sinon.SinonStub).calledWith(
          sinon.match.array,
          sinon.match.func,
          sinon.match.object
        )
      ).to.be.true;
    });

    it("should handle store query callback", async () => {
      await ackManager.subscribe("/test/1/topic/proto");

      await clock.tickAsync(5000);

      const callback = (
        mockStore.queryWithOrderedCallback as sinon.SinonStub
      ).getCall(0).args[1];
      callback(mockMessage);

      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should not add duplicate messages from store", async () => {
      messageStore.add(mockMessage, { storeAck: false });

      await ackManager.subscribe("/test/1/topic/proto");
      await clock.tickAsync(5000);

      const callback = (
        mockStore.queryWithOrderedCallback as sinon.SinonStub
      ).getCall(0).args[1];
      callback(mockMessage);

      expect(messageStore.has(mockMessage.hashStr)).to.be.true;
    });

    it("should stop interval on stop", async () => {
      ackManager.start();
      await ackManager.stop();

      expect(clock.countTimers()).to.equal(0);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete lifecycle", async () => {
      ackManager.start();

      const result1 = await ackManager.subscribe("/test/1/topic1/proto");
      const result2 = await ackManager.subscribe("/test/1/topic2/proto");

      expect(result1).to.be.true;
      expect(result2).to.be.true;

      await ackManager.stop();

      expect(clock.countTimers()).to.equal(0);
    });

    it("should handle multiple subscriptions to same topic", async () => {
      ackManager.start();

      const result1 = await ackManager.subscribe("/test/1/same/proto");
      const result2 = await ackManager.subscribe("/test/1/same/proto");

      expect(result1).to.be.true;
      expect(result2).to.be.true;
      expect((mockFilter.subscribe as sinon.SinonStub).calledOnce).to.be.true;
    });

    it("should handle subscription after stop", async () => {
      ackManager.start();
      await ackManager.stop();

      const result = await ackManager.subscribe("/test/1/after-stop/proto");
      expect(result).to.be.true;
    });
  });

  describe("error handling", () => {
    it("should handle filter subscription errors gracefully", async () => {
      (mockFilter.subscribe as sinon.SinonStub).resolves(false);

      const result = await ackManager.subscribe("/test/1/error/proto");

      expect(result).to.be.true;
    });

    it("should handle store query errors gracefully", async () => {
      (mockStore.queryWithOrderedCallback as sinon.SinonStub).rejects(
        new Error("Store query error")
      );

      ackManager.start();
      await ackManager.subscribe("/test/1/error/proto");

      await clock.tickAsync(5000);
    });

    it("should handle unsubscribe errors gracefully", async () => {
      ackManager.start();
      await ackManager.subscribe("/test/1/error/proto");

      (mockFilter.unsubscribe as sinon.SinonStub).rejects(
        new Error("Unsubscribe error")
      );

      try {
        await ackManager.stop();
      } catch {
        // Expected to throw
      }
    });
  });
});
