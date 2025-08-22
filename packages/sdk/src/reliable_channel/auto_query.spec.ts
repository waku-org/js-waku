import { TypedEventEmitter } from "@libp2p/interface";
import {
  HealthStatus,
  type IDecodedMessage,
  type IDecoder,
  IWakuEventEmitter,
  QueryRequestParams,
  WakuEventType
} from "@waku/interfaces";
import { delay } from "@waku/utils";
import { expect } from "chai";
import sinon from "sinon";

import {
  IPeerManagerEvents,
  PeerManagerEventNames
} from "../peer_manager/peer_manager.js";

import {
  AutoQuery,
  AutoQueryEvent,
  AutoQueryOptions,
  calculateTimeRange,
  DEFAULT_FORCE_QUERY_THRESHOLD_MS
} from "./auto_query.js";

describe("AutoRetrieval", () => {
  let autoRetrieval: AutoQuery<IDecodedMessage>;
  let mockDecoders: IDecoder<IDecodedMessage>[];
  let mockPeerManagerEventEmitter: TypedEventEmitter<IPeerManagerEvents>;
  let mockWakuEventEmitter: IWakuEventEmitter;
  let mockRetrieve: sinon.SinonStub;
  let options: AutoQueryOptions;

  beforeEach(() => {
    // Mock decoders
    mockDecoders = [
      {
        contentTopic: "/test/1/content",
        fromWireToProtoObj: sinon.stub(),
        fromProtoObj: sinon.stub()
      } as any,
      {
        contentTopic: "/test/2/content",
        fromWireToProtoObj: sinon.stub(),
        fromProtoObj: sinon.stub()
      } as any
    ];

    // Mock peer manager event emitter
    mockPeerManagerEventEmitter = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      dispatchEvent: sinon.stub()
    } as any;

    // Mock waku event emitter
    mockWakuEventEmitter = {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub(),
      dispatchEvent: sinon.stub()
    } as any;

    // Mock retrieve function
    mockRetrieve = sinon.stub().returns(
      (async function* () {
        yield [
          Promise.resolve({
            version: 1,
            timestamp: new Date(),
            contentTopic: "/test/1/content",
            pubsubTopic: "/waku/2/default-waku/proto",
            payload: new Uint8Array([1, 2, 3]),
            rateLimitProof: undefined,
            ephemeral: false,
            meta: undefined
          } as IDecodedMessage)
        ];
      })()
    );

    // Mock options
    options = {
      forceQueryThresholdMs: 10000
    };
  });

  describe("constructor", () => {
    it("should create AutoQuery instance with all required parameters", () => {
      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );

      expect(autoRetrieval).to.be.instanceOf(AutoQuery);
      expect(autoRetrieval.decoders).to.equal(mockDecoders);
    });

    it("should create AutoQuery instance without options", () => {
      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve
      );

      expect(autoRetrieval).to.be.instanceOf(AutoQuery);
      expect(autoRetrieval.decoders).to.equal(mockDecoders);
    });

    it("should accept empty decoders array", () => {
      autoRetrieval = new AutoQuery(
        [],
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );

      expect(autoRetrieval.decoders).to.deep.equal([]);
    });

    it("should use default forceQueryThresholdMs when not provided in options", () => {
      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        {}
      );

      expect((autoRetrieval as any).forceQueryThresholdMs).to.equal(
        DEFAULT_FORCE_QUERY_THRESHOLD_MS
      );
    });

    it("should use custom forceQueryThresholdMs when provided in options", () => {
      const customThreshold = 15000;
      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        { forceQueryThresholdMs: customThreshold }
      );

      expect((autoRetrieval as any).forceQueryThresholdMs).to.equal(
        customThreshold
      );
    });
  });

  describe("start and stop", () => {
    beforeEach(() => {
      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );
    });

    it("should set up event listeners when started", () => {
      const peerEventSpy =
        mockPeerManagerEventEmitter.addEventListener as sinon.SinonSpy;
      const wakuEventSpy =
        mockWakuEventEmitter.addEventListener as sinon.SinonSpy;

      autoRetrieval.start();

      expect(peerEventSpy.calledWith(PeerManagerEventNames.StoreConnect)).to.be
        .true;
      expect(wakuEventSpy.calledWith(WakuEventType.Health)).to.be.true;
    });

    it("should remove event listeners when stopped", () => {
      const peerRemoveSpy =
        mockPeerManagerEventEmitter.removeEventListener as sinon.SinonSpy;
      const wakuRemoveSpy =
        mockWakuEventEmitter.removeEventListener as sinon.SinonSpy;

      autoRetrieval.start();
      autoRetrieval.stop();

      expect(peerRemoveSpy.calledWith(PeerManagerEventNames.StoreConnect)).to.be
        .true;
      expect(wakuRemoveSpy.calledWith(WakuEventType.Health)).to.be.true;
    });
  });

  describe("mock validation", () => {
    beforeEach(() => {
      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );
    });

    it("should work with stubbed peer manager event emitter", () => {
      expect(mockPeerManagerEventEmitter.addEventListener).to.be.a("function");
      expect(mockPeerManagerEventEmitter.removeEventListener).to.be.a(
        "function"
      );
      expect(mockPeerManagerEventEmitter.dispatchEvent).to.be.a("function");
    });

    it("should work with stubbed waku event emitter", () => {
      expect(mockWakuEventEmitter.addEventListener).to.be.a("function");
      expect(mockWakuEventEmitter.removeEventListener).to.be.a("function");
      expect(mockWakuEventEmitter.dispatchEvent).to.be.a("function");
    });

    it("should work with stubbed retrieve function", () => {
      expect(mockRetrieve).to.be.a("function");
    });

    it("should work with mock decoders", () => {
      expect(mockDecoders).to.be.an("array");
      expect(mockDecoders[0]).to.have.property("contentTopic");
      expect(mockDecoders[0]).to.have.property("fromWireToProtoObj");
      expect(mockDecoders[0]).to.have.property("fromProtoObj");
    });
  });

  describe("event handling simulation", () => {
    let addEventListenerStub: sinon.SinonStub;
    let healthEventCallback: (event: CustomEvent<HealthStatus>) => void;
    let storeConnectCallback: () => void;

    beforeEach(() => {
      addEventListenerStub = sinon.stub();
      mockPeerManagerEventEmitter.addEventListener = addEventListenerStub;
      mockWakuEventEmitter.addEventListener = sinon
        .stub()
        .callsFake((eventType, callback) => {
          if (eventType === WakuEventType.Health) {
            healthEventCallback = callback;
          }
        });

      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );
    });

    it("should capture event listeners for testing", () => {
      autoRetrieval.start();

      expect(
        addEventListenerStub.calledWith(PeerManagerEventNames.StoreConnect)
      ).to.be.true;

      storeConnectCallback = addEventListenerStub.getCall(0).args[1];
      expect(storeConnectCallback).to.be.a("function");
    });

    it("should properly setup health event callback", () => {
      autoRetrieval.start();

      expect(mockWakuEventEmitter.addEventListener).to.be.a("function");
      expect(healthEventCallback).to.be.a("function");
    });
  });

  describe("async generator retrieve function mock", () => {
    it("should work with async generator that yields promises", async () => {
      const mockMessage: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "",
        version: 1,
        timestamp: new Date(),
        contentTopic: "/test/1/content",
        pubsubTopic: "/waku/2/default-waku/proto",
        payload: new Uint8Array([1, 2, 3]),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      const mockAsyncGenerator = async function* (): AsyncGenerator<
        Promise<IDecodedMessage | undefined>[]
      > {
        yield [Promise.resolve(mockMessage)];
        yield [Promise.resolve(undefined)];
      };

      mockRetrieve.returns(mockAsyncGenerator());

      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );

      const generator = mockRetrieve(mockDecoders, {});
      const firstPage = await generator.next();
      expect(firstPage.done).to.be.false;

      const messages = await Promise.all(firstPage.value);
      expect(messages[0]).to.deep.equal(mockMessage);
    });

    it("should handle retrieve function with query parameters", async () => {
      const queryParams: Partial<QueryRequestParams> = {
        timeStart: new Date(Date.now() - 1000),
        timeEnd: new Date()
      };

      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );

      mockRetrieve(mockDecoders, queryParams);

      expect(mockRetrieve.calledWith(mockDecoders, queryParams)).to.be.true;
    });
  });

  describe("message retrieval event emission conditions", () => {
    let mockClock: sinon.SinonFakeTimers;

    beforeEach(() => {
      mockClock = sinon.useFakeTimers();

      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );
    });

    afterEach(() => {
      mockClock.restore();
    });

    it("should trigger retrieval when lastTimeOffline is after lastSuccessfulQuery", () => {
      autoRetrieval.start();

      // Simulate going offline after last successful query
      (autoRetrieval as any).lastTimeOffline = Date.now();
      (autoRetrieval as any).lastSuccessfulQuery = Date.now() - 1000;

      // Call maybeRetrieve directly to test condition
      (autoRetrieval as any).maybeRetrieve();

      expect(mockRetrieve.calledOnce).to.be.true;
    });

    it("should trigger retrieval when time since last query exceeds threshold", () => {
      autoRetrieval.start();

      // Set lastSuccessfulQuery to simulate old query
      (autoRetrieval as any).lastSuccessfulQuery =
        Date.now() - (DEFAULT_FORCE_QUERY_THRESHOLD_MS + 1000);

      // Call maybeRetrieve directly to test condition
      (autoRetrieval as any).maybeRetrieve();

      expect(mockRetrieve.calledOnce).to.be.true;
    });

    it("should not trigger retrieval when conditions are not met", () => {
      autoRetrieval.start();

      // Set recent successful query
      (autoRetrieval as any).lastSuccessfulQuery = Date.now();
      (autoRetrieval as any).lastTimeOffline = Date.now() - 1000;

      // Call maybeRetrieve directly to test condition
      (autoRetrieval as any).maybeRetrieve();

      expect(mockRetrieve.called).to.be.false;
    });

    it("should properly handle health status updates for offline tracking", () => {
      autoRetrieval.start();

      const initialOfflineTime = (autoRetrieval as any).lastTimeOffline;

      // Advance fake timer to ensure different timestamp
      mockClock.tick(1000);

      // Simulate health status change to unhealthy
      const healthEvent = new CustomEvent<HealthStatus>("health", {
        detail: HealthStatus.Unhealthy
      });

      // Call updateLastOfflineDate directly
      (autoRetrieval as any).updateLastOfflineDate(healthEvent);

      expect((autoRetrieval as any).lastTimeOffline).to.be.greaterThan(
        initialOfflineTime
      );
    });

    it("should not update offline time for healthy status", () => {
      autoRetrieval.start();

      const initialOfflineTime = (autoRetrieval as any).lastTimeOffline;

      // Simulate health status change to healthy
      const healthEvent = new CustomEvent<HealthStatus>("health", {
        detail: HealthStatus.SufficientlyHealthy
      });

      // Call updateLastOfflineDate directly
      (autoRetrieval as any).updateLastOfflineDate(healthEvent);

      expect((autoRetrieval as any).lastTimeOffline).to.equal(
        initialOfflineTime
      );
    });

    it("should respect custom forceQueryThresholdMs in retrieval conditions", () => {
      const customThreshold = 2000;
      const customOptions: AutoQueryOptions = {
        forceQueryThresholdMs: customThreshold
      };

      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        customOptions
      );

      autoRetrieval.start();

      // Set lastSuccessfulQuery to be just over custom threshold
      (autoRetrieval as any).lastSuccessfulQuery =
        Date.now() - (customThreshold + 100);

      // Call maybeRetrieve to test custom threshold
      (autoRetrieval as any).maybeRetrieve();

      expect(mockRetrieve.calledOnce).to.be.true;
    });
  });

  describe("end-to-end message emission tests", () => {
    let storeConnectCallback: () => void;
    let healthEventCallback: (event: CustomEvent<HealthStatus>) => void;
    let messageEventPromise: Promise<IDecodedMessage>;
    let resolveMessageEvent: (message: IDecodedMessage) => void;
    let rejectMessageEvent: (reason: string) => void;

    beforeEach(() => {
      // Create a promise that resolves when a message event is emitted
      messageEventPromise = new Promise<IDecodedMessage>((resolve, reject) => {
        resolveMessageEvent = resolve;
        rejectMessageEvent = reject;
      });

      // Setup event listener capture with proper binding
      mockPeerManagerEventEmitter.addEventListener = sinon
        .stub()
        .callsFake((eventType, callback) => {
          if (eventType === PeerManagerEventNames.StoreConnect) {
            storeConnectCallback = callback;
          }
        });

      mockWakuEventEmitter.addEventListener = sinon
        .stub()
        .callsFake((eventType, callback) => {
          if (eventType === WakuEventType.Health) {
            healthEventCallback = callback;
          }
        });

      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );

      // Listen for message events
      autoRetrieval.addEventListener(
        AutoQueryEvent.MessagesRetrieved as any,
        (event: any) => {
          resolveMessageEvent(event.detail);
        }
      );

      // Set a timeout to reject if no message is received
      setTimeout(
        () => rejectMessageEvent("No message received within timeout"),
        500
      );
    });

    it("should emit message when we just started and store connect event occurs", async () => {
      const mockMessage: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "",
        version: 1,
        timestamp: new Date(),
        contentTopic: "/test/offline/content",
        pubsubTopic: "/waku/2/default-waku/proto",
        payload: new Uint8Array([1, 2, 3]),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      // Setup retrieve function to return the mock message
      const mockAsyncGenerator = async function* (): AsyncGenerator<
        Promise<IDecodedMessage | undefined>[]
      > {
        yield [Promise.resolve(mockMessage)];
      };
      mockRetrieve.returns(mockAsyncGenerator());

      autoRetrieval.start();

      // Step 1: Simulate fresh start
      (autoRetrieval as any).lastSuccessfulQuery = 0;
      (autoRetrieval as any).lastTimeOffline = 0;

      // Step 2: Simulate store peer reconnection
      storeConnectCallback.call(autoRetrieval);

      // Step 4: Wait for message emission
      const receivedMessage = await messageEventPromise;

      expect(receivedMessage).to.deep.equal(mockMessage);
      expect(mockRetrieve.calledOnce).to.be.true;
    });

    it("should emit message when we went offline since last successful query and store reconnect event occurs", async () => {
      const mockMessage: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "",
        version: 1,
        timestamp: new Date(),
        contentTopic: "/test/offline/content",
        pubsubTopic: "/waku/2/default-waku/proto",
        payload: new Uint8Array([1, 2, 3]),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      // Setup retrieve function to return the mock message
      const mockAsyncGenerator = async function* (): AsyncGenerator<
        Promise<IDecodedMessage | undefined>[]
      > {
        yield [Promise.resolve(mockMessage)];
      };
      mockRetrieve.returns(mockAsyncGenerator());

      autoRetrieval.start();

      // Step 1: Simulate successful query in the past
      (autoRetrieval as any).lastSuccessfulQuery = Date.now() - 10000; // 10 seconds ago

      // Step 2: Simulate going offline after the successful query
      const healthEvent = new CustomEvent<HealthStatus>("health", {
        detail: HealthStatus.Unhealthy
      });
      healthEventCallback.call(autoRetrieval, healthEvent);

      // Step 3: Simulate store peer reconnection
      storeConnectCallback.call(autoRetrieval);

      // Step 4: Wait for message emission
      const receivedMessage = await messageEventPromise;

      expect(receivedMessage).to.deep.equal(mockMessage);
      expect(mockRetrieve.calledOnce).to.be.true;
    });

    it("should emit message when store reconnect event occurs and last query was over max time threshold", async () => {
      const mockMessage: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "",
        version: 1,
        timestamp: new Date(),
        contentTopic: "/test/timeout/content",
        pubsubTopic: "/waku/2/default-waku/proto",
        payload: new Uint8Array([4, 5, 6]),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      // Setup retrieve function to return the mock message
      const mockAsyncGenerator = async function* (): AsyncGenerator<
        Promise<IDecodedMessage | undefined>[]
      > {
        yield [Promise.resolve(mockMessage)];
      };
      mockRetrieve.returns(mockAsyncGenerator());

      autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        { forceQueryThresholdMs: 5000 } // 5 second threshold
      );

      // Re-setup event listeners for new instance
      autoRetrieval.addEventListener(
        AutoQueryEvent.MessagesRetrieved as any,
        (event: any) => {
          resolveMessageEvent(event.detail);
        }
      );

      autoRetrieval.start();

      // Step 1: Simulate old successful query (over threshold)
      (autoRetrieval as any).lastSuccessfulQuery = Date.now() - 6000; // 6 seconds ago

      // Step 2: Keep healthy status (no offline period)
      (autoRetrieval as any).lastTimeOffline = 0;

      // Step 3: Simulate store peer reconnection
      storeConnectCallback.call(autoRetrieval);

      // Step 4: Wait for message emission
      const receivedMessage = await messageEventPromise;

      expect(receivedMessage).to.deep.equal(mockMessage);
      expect(mockRetrieve.calledOnce).to.be.true;
    });

    it("should emit multiple messages when retrieve returns multiple messages", async () => {
      const mockMessage1: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "",
        version: 1,
        timestamp: new Date(),
        contentTopic: "/test/multi/content1",
        pubsubTopic: "/waku/2/default-waku/proto",
        payload: new Uint8Array([1, 2, 3]),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      const mockMessage2: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "",
        version: 1,
        timestamp: new Date(),
        contentTopic: "/test/multi/content2",
        pubsubTopic: "/waku/2/default-waku/proto",
        payload: new Uint8Array([4, 5, 6]),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      // Setup retrieve function to return multiple messages
      const mockAsyncGenerator = async function* (): AsyncGenerator<
        Promise<IDecodedMessage | undefined>[]
      > {
        yield [Promise.resolve(mockMessage1)];
        yield [Promise.resolve(mockMessage2)];
      };
      mockRetrieve.returns(mockAsyncGenerator());

      const receivedMessages: IDecodedMessage[] = [];
      let messageCount = 0;

      // Create a new promise for multiple messages
      const multipleMessagesPromise = new Promise<void>((resolve) => {
        autoRetrieval.addEventListener(
          AutoQueryEvent.MessagesRetrieved as any,
          (event: any) => {
            receivedMessages.push(event.detail);
            messageCount++;
            if (messageCount === 2) {
              resolve();
            }
          }
        );
      });

      autoRetrieval.start();

      // Trigger retrieval with offline condition
      (autoRetrieval as any).lastSuccessfulQuery = Date.now() - 1000;
      (autoRetrieval as any).lastTimeOffline = Date.now();

      await delay(10);
      storeConnectCallback.call(autoRetrieval);

      // Wait for all messages with timeout
      await Promise.race([
        multipleMessagesPromise,
        delay(200).then(() =>
          Promise.reject(new Error("Timeout waiting for messages"))
        )
      ]);

      expect(receivedMessages).to.have.length(2);
      expect(receivedMessages[0]).to.deep.equal(mockMessage1);
      expect(receivedMessages[1]).to.deep.equal(mockMessage2);
      expect(mockRetrieve.calledOnce).to.be.true;
    });

    it("should not emit message when conditions are not met (recent query, no offline)", async () => {
      autoRetrieval.start();

      // Set recent successful query and no offline period
      (autoRetrieval as any).lastSuccessfulQuery = Date.now() - 1000; // 1 second ago
      (autoRetrieval as any).lastTimeOffline = 0; // Never went offline

      // Override promise to reject if any message is received
      autoRetrieval.addEventListener(
        AutoQueryEvent.MessagesRetrieved as any,
        () => {
          rejectMessageEvent("Unexpected message emission");
        }
      );

      await delay(10);
      storeConnectCallback.call(autoRetrieval);

      // Wait briefly to ensure no message is emitted
      await delay(50);

      expect(mockRetrieve.called).to.be.false;
    });

    it("should handle retrieve errors gracefully without emitting messages", async () => {
      // Setup retrieve function to throw an error
      mockRetrieve.rejects(new Error("Retrieval failed"));

      autoRetrieval.start();

      // Override promise to reject if any message is received
      autoRetrieval.addEventListener(
        AutoQueryEvent.MessagesRetrieved as any,
        () => {
          rejectMessageEvent("Unexpected message emission after error");
        }
      );

      // Set conditions that would normally trigger retrieval
      (autoRetrieval as any).lastSuccessfulQuery = Date.now() - 10000;
      (autoRetrieval as any).lastTimeOffline = Date.now();

      storeConnectCallback.call(autoRetrieval);

      // Wait briefly to ensure no message is emitted
      await delay(100);

      expect(mockRetrieve.calledOnce).to.be.true;
    });

    it("should update lastSuccessfulQuery timestamp after successful retrieval", async () => {
      const mockMessage: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "",
        version: 1,
        timestamp: new Date(),
        contentTopic: "/test/timestamp/content",
        pubsubTopic: "/waku/2/default-waku/proto",
        payload: new Uint8Array([7, 8, 9]),
        rateLimitProof: undefined,
        ephemeral: false,
        meta: undefined
      };

      const mockAsyncGenerator = async function* (): AsyncGenerator<
        Promise<IDecodedMessage | undefined>[]
      > {
        yield [Promise.resolve(mockMessage)];
      };
      mockRetrieve.returns(mockAsyncGenerator());

      autoRetrieval.start();

      const initialTimestamp = (autoRetrieval as any).lastSuccessfulQuery;

      // Trigger retrieval
      (autoRetrieval as any).lastSuccessfulQuery = Date.now() - 10000;
      (autoRetrieval as any).lastTimeOffline = Date.now();

      storeConnectCallback.call(autoRetrieval);

      // Wait for retrieval to complete
      await messageEventPromise;
      await delay(10);

      const updatedTimestamp = (autoRetrieval as any).lastSuccessfulQuery;
      expect(updatedTimestamp).to.be.greaterThan(initialTimestamp);
    });
  });
});

describe("calculateTimeRange", () => {
  it("should return start time to last successful query since last query is less than max range", () => {
    const now = 1000000; // Some arbitrary timestamp
    const lastSuccessfulQuery = now - 100; // 100ms ago
    const maxTimeRangeQueryMs = 500; // 500ms max range

    const result = calculateTimeRange(
      now,
      lastSuccessfulQuery,
      maxTimeRangeQueryMs
    );

    const expectedTimeStart = new Date(lastSuccessfulQuery);
    const expectedTimeEnd = new Date(now);

    expect(result.timeStart).to.deep.equal(expectedTimeStart);
    expect(result.timeEnd).to.deep.equal(expectedTimeEnd);
  });

  it("should return start time to match max range", () => {
    const now = 1000000;
    const lastSuccessfulQuery = 1000000 - 800; // 800ms ago
    const maxTimeRangeQueryMs = 500; // 500ms max range

    const result = calculateTimeRange(
      now,
      lastSuccessfulQuery,
      maxTimeRangeQueryMs
    );

    const expectedTimeStart = new Date(now - maxTimeRangeQueryMs);
    const expectedTimeEnd = new Date(now);

    expect(result.timeStart).to.deep.equal(expectedTimeStart);
    expect(result.timeEnd).to.deep.equal(expectedTimeEnd);
  });

  it("should handle zero lastSuccessfulQuery (never queried before)", () => {
    const now = 1000000;
    const lastSuccessfulQuery = 0; // Never queried
    const maxTimeRangeQueryMs = 500;

    const result = calculateTimeRange(
      now,
      lastSuccessfulQuery,
      maxTimeRangeQueryMs
    );

    const expectedTimeStart = new Date(now - maxTimeRangeQueryMs); // 1000000 - 1000000 = 0
    const expectedTimeEnd = new Date(now); // 1000000

    expect(result.timeStart).to.deep.equal(expectedTimeStart);
    expect(result.timeEnd).to.deep.equal(expectedTimeEnd);
  });
});
