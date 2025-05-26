import { ConnectionManager, createDecoder } from "@waku/core";
import type {
  IDecodedMessage,
  IDecoder,
  IProtoMessage,
  Libp2p
} from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { PeerManager } from "../peer_manager/index.js";

import { Filter } from "./filter.js";
import { Subscription } from "./subscription.js";

const PUBSUB_TOPIC = "/waku/2/rs/1/4";
const CONTENT_TOPIC = "/test/1/waku-filter/utf8";

describe("Filter SDK", () => {
  let libp2p: Libp2p;
  let filter: Filter;
  let decoder: IDecoder<IDecodedMessage>;
  let callback: sinon.SinonSpy;
  let connectionManager: ConnectionManager;
  let peerManager: PeerManager;

  beforeEach(() => {
    libp2p = mockLibp2p();
    connectionManager = mockConnectionManager();
    peerManager = mockPeerManager();
    filter = mockFilter({ libp2p, connectionManager, peerManager });
    decoder = createDecoder(CONTENT_TOPIC, PUBSUB_TOPIC);
    callback = sinon.spy();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should throw error when subscribing with unsupported pubsub topic", async () => {
    const unsupportedDecoder = createDecoder(
      CONTENT_TOPIC,
      "/unsupported/topic"
    );

    try {
      await filter.subscribe(unsupportedDecoder, callback);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).to.include(
        "Pubsub topic of the decoder is not supported"
      );
    }
  });

  it("should successfully subscribe to supported pubsub topic", async () => {
    const addStub = sinon.stub(Subscription.prototype, "add").resolves(true);
    const startStub = sinon.stub(Subscription.prototype, "start");

    const result = await filter.subscribe(decoder, callback);

    expect(result).to.be.true;
    expect(addStub.calledOnce).to.be.true;
    expect(startStub.calledOnce).to.be.true;
  });

  it("should throw error when unsubscribing with unsupported pubsub topic", async () => {
    const unsupportedDecoder = createDecoder(
      CONTENT_TOPIC,
      "/unsupported/topic"
    );

    try {
      await filter.unsubscribe(unsupportedDecoder);
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).to.include(
        "Pubsub topic /unsupported/topic has not been configured on this instance."
      );
    }
  });

  it("should return false when unsubscribing from a non-existing subscription", async () => {
    const result = await filter.unsubscribe(decoder);
    expect(result).to.be.false;
  });

  it("should successfully unsubscribe from an existing subscription", async () => {
    sinon.stub(Subscription.prototype, "add").resolves(true);
    sinon.stub(Subscription.prototype, "start");
    await filter.subscribe(decoder, callback);

    const removeStub = sinon
      .stub(Subscription.prototype, "remove")
      .resolves(true);
    const isEmptyStub = sinon
      .stub(Subscription.prototype, "isEmpty")
      .returns(true);
    const stopStub = sinon.stub(Subscription.prototype, "stop");

    const result = await filter.unsubscribe(decoder);

    expect(result).to.be.true;
    expect(removeStub.calledOnce).to.be.true;
    expect(isEmptyStub.calledOnce).to.be.true;
    expect(stopStub.calledOnce).to.be.true;
  });

  it("should handle incoming messages", async () => {
    const subscriptionInvokeStub = sinon.stub(Subscription.prototype, "invoke");
    sinon.stub(Subscription.prototype, "add").resolves(true);

    await filter.subscribe(decoder, callback);

    const message = createMockMessage(CONTENT_TOPIC);
    const peerId = "peer1";

    await (filter as any).onIncomingMessage(PUBSUB_TOPIC, message, peerId);

    expect(subscriptionInvokeStub.calledOnce).to.be.true;
    expect(subscriptionInvokeStub.firstCall.args[0]).to.equal(message);
    expect(subscriptionInvokeStub.firstCall.args[1]).to.equal(peerId);
  });
});

function mockLibp2p(): Libp2p {
  return {
    addEventListener: sinon.stub(),
    removeEventListener: sinon.stub(),
    handle: sinon.stub().resolves(),
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
}

function mockConnectionManager(): ConnectionManager {
  return {
    pubsubTopics: [PUBSUB_TOPIC]
  } as ConnectionManager;
}

function mockPeerManager(): PeerManager {
  return {
    getPeers: sinon.stub().returns([])
  } as unknown as PeerManager;
}

type MockFilterOptions = {
  libp2p: Libp2p;
  connectionManager?: ConnectionManager;
  peerManager?: PeerManager;
};

function mockFilter(options: MockFilterOptions): Filter {
  const filter = new Filter({
    libp2p: options.libp2p,
    connectionManager: options.connectionManager || mockConnectionManager(),
    peerManager: options.peerManager || mockPeerManager(),
    options: {
      numPeersToUse: 2,
      pingsBeforePeerRenewed: 3,
      keepAliveIntervalMs: 60_000
    }
  });

  // we're not actually testing FilterCore functionality here
  return filter;
}

function createMockMessage(contentTopic: string): IProtoMessage {
  return {
    payload: new Uint8Array(),
    contentTopic,
    version: 0,
    timestamp: BigInt(Date.now()),
    meta: undefined,
    rateLimitProof: undefined,
    ephemeral: false
  };
}
