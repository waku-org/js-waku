import { EnrDecoder } from "@waku/enr";
import { ProtocolError } from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { PeerExchange } from "./peer_exchange.js";
import { PeerExchangeRPC } from "./rpc.js";

describe("PeerExchange", () => {
  let peerExchange: PeerExchange;
  let mockComponents: any;
  let mockStreamManager: any;
  let mockPeerStore: any;
  let mockStream: any;
  let mockPeerId: any;

  beforeEach(() => {
    mockPeerId = {
      toString: () => "test-peer-id",
      equals: (other: any) => other && other.toString() === "test-peer-id"
    };

    mockStream = {
      sink: sinon.stub(),
      source: (async function* () {
        const data = new Uint8Array([0, 0, 0, 4, 1, 2, 3, 4]);
        yield data;
      })()
    };

    mockStreamManager = {
      getStream: sinon.stub().resolves(mockStream)
    };

    mockPeerStore = {
      has: sinon.stub().resolves(true)
    };

    mockComponents = {
      peerStore: mockPeerStore,
      events: {
        addEventListener: sinon.stub(),
        removeEventListener: sinon.stub()
      }
    };

    peerExchange = new PeerExchange(mockComponents as any);

    (peerExchange as any).streamManager = mockStreamManager;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("constructor", () => {
    it("should initialize with libp2p components", () => {
      const components = {
        peerStore: {},
        events: {
          addEventListener: sinon.stub(),
          removeEventListener: sinon.stub()
        }
      } as any;
      const instance = new PeerExchange(components);
      expect(instance).to.be.instanceOf(PeerExchange);
    });
  });

  describe("query", () => {
    const queryParams = {
      numPeers: 5,
      peerId: mockPeerId
    };

    it("should successfully query peers and return peer infos", async () => {
      const mockResponse = {
        peerInfos: [
          { enr: new Uint8Array([1, 2, 3]) },
          { enr: new Uint8Array([4, 5, 6]) }
        ]
      };

      const mockRpcResponse = {
        response: mockResponse
      };

      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").returns(mockRpcResponse as any);

      const mockEnr = { toString: () => "mock-enr" };
      sinon.stub(EnrDecoder, "fromRLP").resolves(mockEnr as any);

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.be.null;
      expect(result.peerInfos).to.have.length(2);
      expect(result.peerInfos![0]).to.have.property("ENR");
      expect(result.peerInfos![1]).to.have.property("ENR");
    });

    it("should handle empty peer infos gracefully", async () => {
      const mockResponse = {
        peerInfos: []
      };

      const mockRpcResponse = {
        response: mockResponse
      };

      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").returns(mockRpcResponse as any);

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.be.null;
      expect(result.peerInfos).to.have.length(0);
    });

    it("should filter out undefined ENRs", async () => {
      const mockResponse = {
        peerInfos: [
          { enr: new Uint8Array([1, 2, 3]) },
          { enr: undefined },
          { enr: new Uint8Array([4, 5, 6]) }
        ]
      };

      const mockRpcResponse = {
        response: mockResponse
      };

      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").returns(mockRpcResponse as any);

      const mockEnr = { toString: () => "mock-enr" };
      sinon.stub(EnrDecoder, "fromRLP").resolves(mockEnr as any);

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.be.null;
      expect(result.peerInfos).to.have.length(2);
    });

    it("should return NO_PEER_AVAILABLE when peer is not in peer store", async () => {
      mockPeerStore.has.resolves(false);

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.equal(ProtocolError.NO_PEER_AVAILABLE);
      expect(result.peerInfos).to.be.null;
    });

    it("should return NO_STREAM_AVAILABLE when stream creation fails", async () => {
      mockStreamManager.getStream.rejects(new Error("Stream creation failed"));

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.equal(ProtocolError.NO_STREAM_AVAILABLE);
      expect(result.peerInfos).to.be.null;
    });

    it("should return EMPTY_PAYLOAD when response field is missing", async () => {
      const mockRpcResponse = {
        response: undefined
      };

      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").returns(mockRpcResponse as any);

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.equal(ProtocolError.EMPTY_PAYLOAD);
      expect(result.peerInfos).to.be.null;
    });

    it("should return DECODE_FAILED when RPC decode fails", async () => {
      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").throws(new Error("Decode failed"));

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.equal(ProtocolError.DECODE_FAILED);
      expect(result.peerInfos).to.be.null;
    });

    it("should return DECODE_FAILED when ENR decoding fails", async () => {
      const mockResponse = {
        peerInfos: [{ enr: new Uint8Array([1, 2, 3]) }]
      };

      const mockRpcResponse = {
        response: mockResponse
      };

      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").returns(mockRpcResponse as any);
      sinon.stub(EnrDecoder, "fromRLP").rejects(new Error("ENR decode failed"));

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.equal(ProtocolError.DECODE_FAILED);
      expect(result.peerInfos).to.be.null;
    });

    it("should handle malformed response data", async () => {
      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);

      sinon.stub(PeerExchangeRPC, "decode").throws(new Error("Malformed data"));

      const result = await peerExchange.query(queryParams);

      expect(result.error).to.equal(ProtocolError.DECODE_FAILED);
      expect(result.peerInfos).to.be.null;
    });

    it("should handle large number of peers request", async () => {
      const largeQueryParams = {
        numPeers: 1000,
        peerId: mockPeerId
      };

      const mockResponse = {
        peerInfos: Array(1000).fill({ enr: new Uint8Array([1, 2, 3]) })
      };

      const mockRpcResponse = {
        response: mockResponse
      };

      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").returns(mockRpcResponse as any);

      const mockEnr = { toString: () => "mock-enr" };
      sinon.stub(EnrDecoder, "fromRLP").resolves(mockEnr as any);

      const result = await peerExchange.query(largeQueryParams);

      expect(result.error).to.be.null;
      expect(result.peerInfos).to.have.length(1000);
    });

    it("should handle zero peers request", async () => {
      const zeroQueryParams = {
        numPeers: 0,
        peerId: mockPeerId
      };

      const mockResponse = {
        peerInfos: []
      };

      const mockRpcResponse = {
        response: mockResponse
      };

      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      sinon.stub(PeerExchangeRPC, "createRequest").returns(mockRpcQuery as any);
      sinon.stub(PeerExchangeRPC, "decode").returns(mockRpcResponse as any);

      const result = await peerExchange.query(zeroQueryParams);

      expect(result.error).to.be.null;
      expect(result.peerInfos).to.have.length(0);
    });

    it("should create RPC request with correct parameters", async () => {
      const mockRpcQuery = {
        encode: sinon.stub().returns(new Uint8Array([1, 2, 3]))
      };
      const createRequestStub = sinon
        .stub(PeerExchangeRPC, "createRequest")
        .returns(mockRpcQuery as any);
      sinon
        .stub(PeerExchangeRPC, "decode")
        .returns({ response: { peerInfos: [] } } as any);

      await peerExchange.query(queryParams);

      expect(createRequestStub.calledOnce).to.be.true;
      expect(createRequestStub.firstCall.args[0]).to.deep.equal({
        numPeers: BigInt(queryParams.numPeers)
      });
    });

    it("should create PeerExchange instance with components", () => {
      const instance = new PeerExchange(mockComponents as any);
      expect(instance).to.be.instanceOf(PeerExchange);
    });
  });
});
