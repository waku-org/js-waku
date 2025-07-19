import { StoreCore } from "@waku/core";
import type { IDecodedMessage, IDecoder, Libp2p } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";
import sinon from "sinon";

import { PeerManager } from "../peer_manager/index.js";

import { Store } from "./store.js";

describe("Store", () => {
  let store: Store;
  let mockLibp2p: Libp2p;
  let mockPeerManager: sinon.SinonStubbedInstance<PeerManager>;
  let mockStoreCore: sinon.SinonStubbedInstance<StoreCore>;
  let mockPeerId: any;
  const testContentTopic = "/test/1/waku-light-push/utf8";
  const testRoutingInfo = createRoutingInfo(
    {
      clusterId: 0,
      numShardsInCluster: 7
    },
    { contentTopic: testContentTopic }
  );

  beforeEach(() => {
    mockPeerId = {
      toString: () => "QmTestPeerId"
    };

    mockStoreCore = {
      multicodec: "test-multicodec",
      maxTimeLimit: 24 * 60 * 60 * 1000, // 24 hours
      queryPerPage: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<StoreCore>;

    mockLibp2p = {
      dial: sinon.stub(),
      components: {
        events: {
          addEventListener: sinon.stub(),
          removeEventListener: sinon.stub()
        }
      }
    } as unknown as Libp2p;

    mockPeerManager = {
      getPeers: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<PeerManager>;

    // Stub the StoreCore methods
    sinon
      .stub(StoreCore.prototype, "queryPerPage")
      .callsFake(mockStoreCore.queryPerPage);

    // Stub the maxTimeLimit getter
    sinon
      .stub(StoreCore.prototype, "maxTimeLimit")
      .get(() => 24 * 60 * 60 * 1000);

    store = new Store({
      libp2p: mockLibp2p,
      peerManager: mockPeerManager
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("queryGenerator", () => {
    const mockDecoder: IDecoder<IDecodedMessage> = {
      routingInfo: testRoutingInfo,
      contentTopic: testContentTopic,
      fromWireToProtoObj: sinon.stub(),
      fromProtoObj: sinon.stub()
    };

    const mockMessage: IDecodedMessage = {
      version: 1,
      pubsubTopic: "/waku/2/default-waku/proto",
      contentTopic: "/test/1/test/proto",
      payload: new Uint8Array([1, 2, 3]),
      timestamp: new Date(),
      rateLimitProof: undefined,
      ephemeral: undefined,
      meta: undefined
    };

    it("should successfully query store with valid decoders and options", async () => {
      const mockMessages = [Promise.resolve(mockMessage)];
      const mockResponseGenerator = (async function* () {
        yield mockMessages;
      })();

      mockPeerManager.getPeers.resolves([mockPeerId]);
      mockStoreCore.queryPerPage.returns(mockResponseGenerator);

      const generator = store.queryGenerator([mockDecoder]);
      const results: any = [];

      for await (const messages of generator) {
        results.push(messages);
      }

      expect(
        mockPeerManager.getPeers.calledWith({
          protocol: Protocols.Store,
          routingInfo: testRoutingInfo
        })
      ).to.be.true;

      expect(mockStoreCore.queryPerPage.called).to.be.true;

      expect(results).to.have.length(1);
      expect(results[0]).to.equal(mockMessages);
    });

    it("should throw error when no peers are available", async () => {
      mockPeerManager.getPeers.resolves([]);

      const generator = store.queryGenerator([mockDecoder]);

      try {
        for await (const _ of generator) {
          // This should not be reached
        }
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          "No peers available to query"
        );
      }
    });

    it("should handle multiple query options for time ranges", async () => {
      const timeStart = new Date("2023-01-01T00:00:00Z");
      const timeEnd = new Date("2023-01-03T00:00:01Z"); // 48 hours + 1ms later

      const mockMessages1 = [Promise.resolve(mockMessage)];
      const mockMessages2 = [Promise.resolve(mockMessage)];

      const mockResponseGenerator1 = (async function* () {
        yield mockMessages1;
      })();

      const mockResponseGenerator2 = (async function* () {
        yield mockMessages2;
      })();

      mockPeerManager.getPeers.resolves([mockPeerId]);
      mockStoreCore.queryPerPage
        .onFirstCall()
        .returns(mockResponseGenerator1)
        .onSecondCall()
        .returns(mockResponseGenerator2);

      const generator = store.queryGenerator([mockDecoder], {
        timeStart,
        timeEnd
      });

      const results: any = [];
      for await (const messages of generator) {
        results.push(messages);
      }

      expect(mockStoreCore.queryPerPage.callCount).to.equal(2);
      expect(results).to.have.length(2);
    });

    it("should chunk queries when time window exceeds maxTimeLimit", async () => {
      // Create a time range that's 3x the maxTimeLimit (72 hours)
      const timeStart = new Date("2023-01-01T00:00:00Z");
      const timeEnd = new Date("2023-01-04T00:00:01Z"); // 72 hours + 1ms later

      const maxTimeLimit = 24 * 60 * 60 * 1000; // 24 hours in ms

      // Should create 3 chunks: [0-24h], [24h-48h], [48h-72h+1ms]
      const expectedChunks = 3;

      const mockMessages1 = [Promise.resolve(mockMessage)];
      const mockMessages2 = [Promise.resolve(mockMessage)];
      const mockMessages3 = [Promise.resolve(mockMessage)];

      const mockResponseGenerator1 = (async function* () {
        yield mockMessages1;
      })();

      const mockResponseGenerator2 = (async function* () {
        yield mockMessages2;
      })();

      const mockResponseGenerator3 = (async function* () {
        yield mockMessages3;
      })();

      mockPeerManager.getPeers.resolves([mockPeerId]);
      mockStoreCore.queryPerPage
        .onFirstCall()
        .returns(mockResponseGenerator1)
        .onSecondCall()
        .returns(mockResponseGenerator2)
        .onThirdCall()
        .returns(mockResponseGenerator3);

      const generator = store.queryGenerator([mockDecoder], {
        timeStart,
        timeEnd
      });

      const results: any = [];
      for await (const messages of generator) {
        results.push(messages);
      }

      expect(mockStoreCore.queryPerPage.callCount).to.equal(expectedChunks);
      expect(results).to.have.length(expectedChunks);

      // Verify that each call was made with the correct time ranges
      const calls = mockStoreCore.queryPerPage.getCalls();

      // First chunk: timeStart to timeStart + maxTimeLimit
      const firstCallArgs = calls[0].args[0] as any;
      expect(firstCallArgs.timeStart).to.deep.equal(timeStart);
      expect(firstCallArgs.timeEnd.getTime()).to.equal(
        timeStart.getTime() + maxTimeLimit
      );

      // Second chunk: timeStart + maxTimeLimit to timeStart + 2*maxTimeLimit
      const secondCallArgs = calls[1].args[0] as any;
      expect(secondCallArgs.timeStart.getTime()).to.equal(
        timeStart.getTime() + maxTimeLimit
      );
      expect(secondCallArgs.timeEnd.getTime()).to.equal(
        timeStart.getTime() + 2 * maxTimeLimit
      );

      // Third chunk: timeStart + 2*maxTimeLimit to timeEnd
      const thirdCallArgs = calls[2].args[0] as any;
      expect(thirdCallArgs.timeStart.getTime()).to.equal(
        timeStart.getTime() + 2 * maxTimeLimit
      );

      // The third chunk should end at timeStart + 3*maxTimeLimit, not timeEnd
      expect(thirdCallArgs.timeEnd.getTime()).to.equal(
        timeStart.getTime() + 3 * maxTimeLimit
      );
    });

    it("should handle hash queries without validation", async () => {
      const mockMessages = [Promise.resolve(mockMessage)];
      const mockResponseGenerator = (async function* () {
        yield mockMessages;
      })();

      mockPeerManager.getPeers.resolves([mockPeerId]);
      mockStoreCore.queryPerPage.returns(mockResponseGenerator);

      const generator = store.queryGenerator([mockDecoder], {
        messageHashes: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
        routingInfo: testRoutingInfo
      });

      const results: any = [];
      for await (const messages of generator) {
        results.push(messages);
      }

      expect(mockStoreCore.queryPerPage.called).to.be.true;

      expect(results).to.have.length(1);
    });

    it("should use configured peers when available", async () => {
      const configuredPeers = ["/ip4/127.0.0.1/tcp/30303/p2p/QmConfiguredPeer"];

      store = new Store({
        libp2p: mockLibp2p,
        peerManager: mockPeerManager,
        options: { peers: configuredPeers }
      });

      const mockMessages = [Promise.resolve(mockMessage)];
      const mockResponseGenerator = (async function* () {
        yield mockMessages;
      })();

      mockPeerManager.getPeers.resolves([mockPeerId]);
      mockStoreCore.queryPerPage.returns(mockResponseGenerator);

      const generator = store.queryGenerator([mockDecoder]);

      for await (const _ of generator) {
        // Just consume the generator
      }

      expect(mockPeerManager.getPeers.called).to.be.true;
    });
  });
});
