import { type PeerId, TypedEventEmitter } from "@libp2p/interface";
import {
  HealthStatus,
  type IDecodedMessage,
  type IDecoder,
  IWakuEventEmitter,
  QueryRequestParams,
  WakuEventType
} from "@waku/interfaces";
import { delay } from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
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
  calculateTimeRange
} from "./auto_query.js";

describe("AutoQuery", () => {
  let autoQuery: AutoQuery<IDecodedMessage>;
  let mockDecoders: IDecoder<IDecodedMessage>[];
  let mockPeerManagerEventEmitter: TypedEventEmitter<IPeerManagerEvents>;
  let mockWakuEventEmitter: IWakuEventEmitter;
  let mockQueryGenerator: sinon.SinonStub;
  let mockPeerId: PeerId;
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
    mockQueryGenerator = sinon.stub().callsFake(() =>
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
            meta: undefined,
            hashStr: "12345"
          } as IDecodedMessage)
        ];
      })()
    );

    mockPeerId = {
      toString: () => "QmTestPeerId"
    } as unknown as PeerId;

    // Mock options
    options = {
      forceQueryThresholdMs: 10000
    };
  });

  describe("constructor", () => {
    it("should create AutoQuery instance with all required parameters", () => {
      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );

      expect(autoQuery).to.be.instanceOf(AutoQuery);
      expect(autoQuery.decoders).to.equal(mockDecoders);
    });

    it("should create AutoQuery instance without options", () => {
      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator
      );

      expect(autoQuery).to.be.instanceOf(AutoQuery);
      expect(autoQuery.decoders).to.equal(mockDecoders);
    });

    it("should accept empty decoders array", () => {
      autoQuery = new AutoQuery(
        [],
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );

      expect(autoQuery.decoders).to.deep.equal([]);
    });
  });

  describe("start and stop", () => {
    beforeEach(() => {
      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );
    });

    it("should set up event listeners when started", () => {
      const peerEventSpy =
        mockPeerManagerEventEmitter.addEventListener as sinon.SinonSpy;
      const wakuEventSpy =
        mockWakuEventEmitter.addEventListener as sinon.SinonSpy;

      autoQuery.start();

      expect(peerEventSpy.calledWith(PeerManagerEventNames.StoreConnect)).to.be
        .true;
      expect(wakuEventSpy.calledWith(WakuEventType.Health)).to.be.true;
    });

    it("should remove event listeners when stopped", () => {
      const peerRemoveSpy =
        mockPeerManagerEventEmitter.removeEventListener as sinon.SinonSpy;
      const wakuRemoveSpy =
        mockWakuEventEmitter.removeEventListener as sinon.SinonSpy;

      autoQuery.start();
      autoQuery.stop();

      expect(peerRemoveSpy.calledWith(PeerManagerEventNames.StoreConnect)).to.be
        .true;
      expect(wakuRemoveSpy.calledWith(WakuEventType.Health)).to.be.true;
    });
  });

  describe("mock validation", () => {
    beforeEach(() => {
      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
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
      expect(mockQueryGenerator).to.be.a("function");
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

      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );
    });

    it("should capture event listeners for testing", () => {
      autoQuery.start();

      expect(
        addEventListenerStub.calledWith(PeerManagerEventNames.StoreConnect)
      ).to.be.true;

      storeConnectCallback = addEventListenerStub.getCall(0).args[1];
      expect(storeConnectCallback).to.be.a("function");
    });

    it("should properly setup health event callback", () => {
      autoQuery.start();

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

      mockQueryGenerator.returns(mockAsyncGenerator());

      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );

      const generator = mockQueryGenerator(mockDecoders, {});
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

      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );

      mockQueryGenerator(mockDecoders, queryParams);

      expect(mockQueryGenerator.calledWith(mockDecoders, queryParams)).to.be
        .true;
    });
  });

  describe("message retrieval event emission conditions", () => {
    let mockClock: sinon.SinonFakeTimers;

    beforeEach(() => {
      mockClock = sinon.useFakeTimers();
      mockClock.tick(10); // always tick as now === 0 messes up the logic

      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );
    });

    afterEach(() => {
      mockClock.restore();
    });

    it("should trigger query when it went offline since the last successful query", async () => {
      let healthEventCallback:
        | ((event: CustomEvent<HealthStatus>) => void)
        | undefined;

      // Capture the health event callback
      mockWakuEventEmitter.addEventListener = sinon
        .stub()
        .callsFake((eventType, callback) => {
          if (eventType === WakuEventType.Health) {
            healthEventCallback = callback;
          }
        });

      autoQuery.start();

      // Set lastSuccessfulQuery to simulate old query
      await autoQuery.maybeQuery(mockPeerId);
      mockClock.tick(1);

      // goes offline
      const healthEvent = new CustomEvent<HealthStatus>("health", {
        detail: HealthStatus.Unhealthy
      });
      expect(healthEventCallback).to.not.be.undefined;
      healthEventCallback!.call(autoQuery, healthEvent);
      mockClock.tick(1);

      // Call maybeQuery directly to test condition
      await autoQuery.maybeQuery(mockPeerId);

      expect(mockQueryGenerator.calledTwice).to.be.true;
    });

    it("should not trigger query if health event is healthy since last successful query", async () => {
      autoQuery.start();

      // Set lastSuccessfulQuery to simulate old query
      await autoQuery.maybeQuery(mockPeerId);

      // goes offline
      const healthEvent = new CustomEvent<HealthStatus>("health", {
        detail: HealthStatus.SufficientlyHealthy
      });
      mockWakuEventEmitter.dispatchEvent(healthEvent);

      // Call maybeQuery directly to test condition
      await autoQuery.maybeQuery(mockPeerId);

      expect(mockQueryGenerator.calledOnce).to.be.true;
    });

    it("should trigger query when time since last query exceeds threshold", async function () {
      const customThreshold = 10;
      const customOptions: AutoQueryOptions = {
        forceQueryThresholdMs: customThreshold
      };

      const autoRetrieval = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        customOptions
      );
      autoRetrieval.start();

      // Set lastSuccessfulQuery to simulate old query
      await autoRetrieval.maybeQuery(mockPeerId);

      // Advance fake timer over the force threshold
      mockClock.tick(20);

      // Call maybeQuery directly to test condition
      await autoRetrieval.maybeQuery(mockPeerId);

      expect(mockQueryGenerator.calledTwice).to.be.true;
    });

    it("should not trigger query when a recent query happened under threshold", async () => {
      const customThreshold = 2000;
      const customOptions: AutoQueryOptions = {
        forceQueryThresholdMs: customThreshold
      };

      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        customOptions
      );

      autoQuery.start();

      // First call to set a successful call
      await autoQuery.maybeQuery(mockPeerId);

      // Second call should not trigger
      await autoQuery.maybeQuery(mockPeerId);

      expect(mockQueryGenerator.calledOnce).to.be.true;
    });
  });

  describe("end-to-end message emission tests", () => {
    let storeConnectCallback: (event: CustomEvent<PeerId>) => void;
    let healthEventCallback: (event: CustomEvent<HealthStatus>) => void;
    let messageEventPromise: Promise<IDecodedMessage[]>;
    let resolveMessageEvent: (messages: IDecodedMessage[]) => void;
    let rejectMessageEvent: (reason: string) => void;
    let connectStoreEvent: CustomEvent<PeerId>;

    beforeEach(() => {
      // Create a promise that resolves when a message event is emitted
      messageEventPromise = new Promise<IDecodedMessage[]>(
        (resolve, reject) => {
          resolveMessageEvent = resolve;
          rejectMessageEvent = reject;
        }
      );

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

      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        options
      );

      // Listen for message events
      autoQuery.addEventListener(
        AutoQueryEvent.MessagesRetrieved,
        (event: CustomEvent<IDecodedMessage[]>) => {
          resolveMessageEvent(event.detail);
        }
      );

      connectStoreEvent = new CustomEvent<PeerId>("connect:store", {
        detail: mockPeerId
      });

      // Set a timeout to reject if no message is received
      setTimeout(
        () => rejectMessageEvent("No message received within timeout"),
        500
      );
    });

    it("should emit message when we just started and store connect event occurs", async () => {
      const mockMessage: IDecodedMessage = {
        hash: utf8ToBytes("1234"),
        hashStr: "1234",
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
      mockQueryGenerator.returns(mockAsyncGenerator());

      autoQuery.start();

      // Step 2: Simulate store peer reconnection
      storeConnectCallback.call(autoQuery, connectStoreEvent);

      // Step 4: Wait for message emission
      const receivedMessage = await messageEventPromise;

      expect(receivedMessage).to.deep.equal([mockMessage]);
      expect(mockQueryGenerator.calledOnce).to.be.true;
    });

    it("should emit message when we went offline since last successful query and store reconnect event occurs", async () => {
      const mockMessage: IDecodedMessage = {
        hash: new Uint8Array(),
        hashStr: "1234",
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
      mockQueryGenerator.returns(mockAsyncGenerator());

      autoQuery.start();

      // Step 1: Simulate successful query in the past
      await autoQuery.maybeQuery(mockPeerId);
      await delay(100);

      // Step 2: Simulate going offline after the successful query
      const healthEvent = new CustomEvent<HealthStatus>("health", {
        detail: HealthStatus.Unhealthy
      });
      healthEventCallback.call(autoQuery, healthEvent);

      // Step 3: Simulate store peer reconnection
      storeConnectCallback.call(autoQuery, connectStoreEvent);

      // Step 4: Wait for message emission
      const receivedMessages = await messageEventPromise;

      expect(receivedMessages).to.deep.equal([mockMessage]);
      expect(mockQueryGenerator.calledTwice).to.be.true;
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
      mockQueryGenerator.returns(mockAsyncGenerator());

      autoQuery = new AutoQuery(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockQueryGenerator,
        { forceQueryThresholdMs: 5000 } // 5 second threshold
      );

      // Re-setup event listeners for new instance
      autoQuery.addEventListener(
        AutoQueryEvent.MessagesRetrieved,
        (event: CustomEvent<IDecodedMessage[]>) => {
          resolveMessageEvent(event.detail);
        }
      );

      autoQuery.start();

      // Step 1: Simulate old successful query (over threshold)
      await autoQuery.maybeQuery(mockPeerId);

      // Step 3: Simulate store peer reconnection
      storeConnectCallback.call(autoQuery, connectStoreEvent);

      // Step 4: Wait for message emission
      const receivedMessages = await messageEventPromise;

      expect(receivedMessages).to.deep.equal([mockMessage]);
      expect(mockQueryGenerator.calledOnce).to.be.true;
    });

    it("should emit multiple messages when query returns multiple messages", async () => {
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
      mockQueryGenerator.returns(mockAsyncGenerator());

      const receivedMessages: IDecodedMessage[] = [];
      let messageCount = 0;

      // Create a new promise for multiple messages
      const multipleMessagesPromise = new Promise<void>((resolve) => {
        autoQuery.addEventListener(
          AutoQueryEvent.MessagesRetrieved,
          (event: CustomEvent<IDecodedMessage[]>) => {
            receivedMessages.push(...event.detail);
            messageCount++;
            if (messageCount === 2) {
              resolve();
            }
          }
        );
      });

      autoQuery.start();

      storeConnectCallback.call(autoQuery, connectStoreEvent);

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
      expect(mockQueryGenerator.calledOnce).to.be.true;
    });

    it("should not emit message when conditions are not met (recent query, no offline)", async () => {
      autoQuery.start();

      await autoQuery.maybeQuery(mockPeerId);

      // Override promise to reject if any message is received
      autoQuery.addEventListener(AutoQueryEvent.MessagesRetrieved, () => {
        rejectMessageEvent("Unexpected message emission");
      });

      await delay(10);
      storeConnectCallback.call(autoQuery, connectStoreEvent);

      // Wait briefly to ensure no message is emitted
      await delay(50);

      expect(mockQueryGenerator.calledOnce).to.be.true;
    });

    it("should handle retrieve errors gracefully without emitting messages", async () => {
      // Setup retrieve function to throw an error
      mockQueryGenerator.rejects(new Error("Retrieval failed"));

      autoQuery.start();

      // Override promise to reject if any message is received
      autoQuery.addEventListener(
        AutoQueryEvent.MessagesRetrieved,
        (_event: CustomEvent<IDecodedMessage[]>) => {
          rejectMessageEvent("Unexpected message emission after error");
        }
      );

      await autoQuery.maybeQuery(mockPeerId);
      storeConnectCallback.call(autoQuery, connectStoreEvent);

      // Wait briefly to ensure no message is emitted
      await delay(100);

      expect(mockQueryGenerator.calledTwice).to.be.true;
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
