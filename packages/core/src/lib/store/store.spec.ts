import type { PeerId } from "@libp2p/interface";
import {
  IDecodedMessage,
  IDecoder,
  Libp2p,
  QueryRequestParams
} from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";
import sinon from "sinon";

import { StreamManager } from "../stream_manager/index.js";

import {
  MAX_PAGE_SIZE,
  MAX_TIME_RANGE,
  StoreQueryRequest,
  StoreQueryResponse
} from "./rpc.js";
import { StoreCore } from "./store.js";

describe("StoreCore", () => {
  let libp2p: Libp2p;
  let storeCore: StoreCore;
  let mockStreamManager: sinon.SinonStubbedInstance<StreamManager>;
  let mockPeerId: PeerId;
  let mockStream: any;
  let mockDecoder: sinon.SinonStubbedInstance<IDecoder<IDecodedMessage>>;
  let decoders: Map<string, IDecoder<IDecodedMessage>>;

  const createMockPeerId = (id: string): PeerId =>
    ({
      toString: () => id,
      equals: (other: PeerId) => other.toString() === id
    }) as PeerId;

  beforeEach(() => {
    libp2p = {
      components: {
        events: {
          addEventListener: sinon.stub(),
          removeEventListener: sinon.stub()
        },
        connectionManager: {
          getConnections: sinon.stub().returns([])
        }
      }
    } as unknown as Libp2p;

    mockStreamManager = {
      getStream: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<StreamManager>;

    mockPeerId = createMockPeerId("12D3KooWTest1");

    mockStream = {
      sink: sinon.stub(),
      source: []
    };

    mockDecoder = {
      fromProtoObj: sinon.stub()
    } as unknown as sinon.SinonStubbedInstance<IDecoder<IDecodedMessage>>;

    decoders = new Map([["test-topic", mockDecoder]]);

    sinon
      .stub(StreamManager.prototype, "getStream")
      .callsFake(mockStreamManager.getStream);
    storeCore = new StoreCore(libp2p);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("queryPerPage", () => {
    let queryOpts: QueryRequestParams;
    let mockStoreQueryRequest: any;
    let mockStoreQueryResponse: any;
    const testContentTopic = "/test/1/waku-light-push/utf8";
    const testRoutingInfo = createRoutingInfo(
      {
        clusterId: 0,
        numShardsInCluster: 7
      },
      { contentTopic: testContentTopic }
    );

    beforeEach(() => {
      queryOpts = {
        routingInfo: testRoutingInfo,
        contentTopics: ["test-topic"],
        paginationLimit: 10,
        includeData: true,
        paginationForward: true
      };

      mockStoreQueryRequest = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };

      mockStoreQueryResponse = {
        statusCode: 200,
        statusDesc: "OK",
        messages: [
          {
            messageHash: new Uint8Array([1]),
            message: {
              contentTopic: "test-topic"
            },
            pubsubTopic: "test-topic"
          }
        ]
      };

      sinon.stub(StoreQueryRequest, "create").returns(mockStoreQueryRequest);
      sinon.stub(StoreQueryResponse, "decode").returns(mockStoreQueryResponse);
    });

    it("throws if time range exceeds MAX_TIME_RANGE", async () => {
      queryOpts.timeStart = new Date();
      queryOpts.timeEnd = new Date(
        queryOpts.timeStart.getTime() + MAX_TIME_RANGE + 1000
      );
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      try {
        await generator.next();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.equal("Time range bigger than 24h");
      }
    });

    it("throws if decoders don't match content topics", async () => {
      const differentDecoders = new Map([["different-topic", mockDecoder]]);
      const generator = storeCore.queryPerPage(
        queryOpts,
        differentDecoders,
        mockPeerId
      );
      try {
        await generator.next();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.equal(
          "Internal error, the decoders should match the query's content topics"
        );
      }
    });

    it("does not validate decoders for hash queries", async () => {
      queryOpts.messageHashes = [new Uint8Array([1, 2, 3])];
      queryOpts.contentTopics = [];
      const differentDecoders = new Map([["different-topic", mockDecoder]]);
      mockStreamManager.getStream.resolves(mockStream);
      const generator = storeCore.queryPerPage(
        queryOpts,
        differentDecoders,
        mockPeerId
      );
      const result = await generator.next();
      expect(result.done).to.be.false;
    });

    it("ends if stream creation fails", async () => {
      mockStreamManager.getStream.rejects(new Error("Stream creation failed"));
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      const result = await generator.next();
      expect(result.done).to.be.true;
    });

    it("throws if store query response has error status", async () => {
      mockStoreQueryResponse.statusCode = 400;
      mockStoreQueryResponse.statusDesc = "Bad Request";
      mockStreamManager.getStream.resolves(mockStream);
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      try {
        await generator.next();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).to.equal(
          "Store query failed with status code: 400, description: Bad Request"
        );
      }
    });

    it("ends if response has no messages", async () => {
      mockStoreQueryResponse.messages = [];
      mockStreamManager.getStream.resolves(mockStream);
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      const result = await generator.next();
      expect(result.done).to.be.true;
    });

    it("yields decoded messages", async () => {
      const mockDecodedMessage = {
        contentTopic: "test-topic"
      } as IDecodedMessage;
      mockDecoder.fromProtoObj.resolves(mockDecodedMessage);
      mockStreamManager.getStream.resolves(mockStream);
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      const result = await generator.next();
      const decodedMessage = await result.value[0];
      expect(decodedMessage).to.equal(mockDecodedMessage);
    });

    it("yields undefined for messages without content topic", async () => {
      mockStoreQueryResponse.messages[0].message.contentTopic = undefined;
      mockStreamManager.getStream.resolves(mockStream);
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      const result = await generator.next();
      const decodedMessage = await result.value[0];
      expect(decodedMessage).to.be.undefined;
    });

    it("yields undefined for messages without decoder", async () => {
      mockStoreQueryResponse.messages[0].message.contentTopic = "unknown-topic";
      mockStreamManager.getStream.resolves(mockStream);
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      const result = await generator.next();
      const decodedMessage = await result.value[0];
      expect(decodedMessage).to.be.undefined;
    });

    it("ends after yielding if response size indicates end", async () => {
      queryOpts.paginationLimit = MAX_PAGE_SIZE + 10;
      mockStoreQueryResponse.messages = new Array(MAX_PAGE_SIZE + 1).fill({
        messageHash: new Uint8Array([1]),
        message: { contentTopic: "test-topic" }
      });
      mockStreamManager.getStream.resolves(mockStream);
      const generator = storeCore.queryPerPage(queryOpts, decoders, mockPeerId);
      await generator.next();
      const second = await generator.next();
      expect(second.done).to.be.true;
    });
  });
});
