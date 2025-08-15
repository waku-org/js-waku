import { TypedEventEmitter } from "@libp2p/interface";
import {
  HealthStatus,
  type IDecodedMessage,
  type IDecoder,
  IWakuEventEmitter,
  QueryRequestParams,
  WakuEventType
} from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import {
  IPeerManagerEvents,
  PeerManagerEventNames
} from "../peer_manager/peer_manager.js";

import {
  AutoRetrieval,
  AutoRetrievalOptions,
  DEFAULT_FORCE_QUERY_THRESHOLD_MS
} from "./auto_retrieval.js";

describe("AutoRetrieval", () => {
  let autoRetrieval: AutoRetrieval<IDecodedMessage>;
  let mockDecoders: IDecoder<IDecodedMessage>[];
  let mockPeerManagerEventEmitter: TypedEventEmitter<IPeerManagerEvents>;
  let mockWakuEventEmitter: IWakuEventEmitter;
  let mockRetrieve: sinon.SinonStub;
  let options: AutoRetrievalOptions;

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
    it("should create AutoRetrieval instance with all required parameters", () => {
      autoRetrieval = new AutoRetrieval(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );

      expect(autoRetrieval).to.be.instanceOf(AutoRetrieval);
      expect(autoRetrieval.decoders).to.equal(mockDecoders);
    });

    it("should create AutoRetrieval instance without options", () => {
      autoRetrieval = new AutoRetrieval(
        mockDecoders,
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve
      );

      expect(autoRetrieval).to.be.instanceOf(AutoRetrieval);
      expect(autoRetrieval.decoders).to.equal(mockDecoders);
    });

    it("should accept empty decoders array", () => {
      autoRetrieval = new AutoRetrieval(
        [],
        mockPeerManagerEventEmitter,
        mockWakuEventEmitter,
        mockRetrieve,
        options
      );

      expect(autoRetrieval.decoders).to.deep.equal([]);
    });

    it("should use default forceQueryThresholdMs when not provided in options", () => {
      autoRetrieval = new AutoRetrieval(
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
      autoRetrieval = new AutoRetrieval(
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
      autoRetrieval = new AutoRetrieval(
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
      autoRetrieval = new AutoRetrieval(
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

      autoRetrieval = new AutoRetrieval(
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

      autoRetrieval = new AutoRetrieval(
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

      autoRetrieval = new AutoRetrieval(
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

      autoRetrieval = new AutoRetrieval(
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
      const customOptions: AutoRetrievalOptions = {
        forceQueryThresholdMs: customThreshold
      };

      autoRetrieval = new AutoRetrieval(
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
});
