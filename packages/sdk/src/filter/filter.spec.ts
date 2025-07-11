import { ConnectionManager, createDecoder } from "@waku/core";
import type {
  IDecodedMessage,
  IDecoder,
  IProtoMessage,
  Libp2p
} from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";
import sinon from "sinon";

import { PeerManager } from "../peer_manager/index.js";

import { Filter } from "./filter.js";
import { Subscription } from "./subscription.js";

const testContentTopic = "/test/1/waku-filter/utf8";
const testNetworkconfig = {
  clusterId: 0,
  numShardsInCluster: 9
};
const testRoutingInfo = createRoutingInfo(testNetworkconfig, {
  contentTopic: testContentTopic
});
const testPubsubTopic = testRoutingInfo.pubsubTopic;

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
    decoder = createDecoder(testContentTopic, testRoutingInfo);
    callback = sinon.spy();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should successfully subscribe to supported pubsub topic", async () => {
    const addStub = sinon.stub(Subscription.prototype, "add").resolves(true);
    const startStub = sinon.stub(Subscription.prototype, "start");

    const result = await filter.subscribe(decoder, callback);

    expect(result).to.be.true;
    expect(addStub.calledOnce).to.be.true;
    expect(startStub.calledOnce).to.be.true;
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

    const message = createMockMessage(testContentTopic);
    const peerId = "peer1";

    await (filter as any).onIncomingMessage(testPubsubTopic, message, peerId);

    expect(subscriptionInvokeStub.calledOnce).to.be.true;
    expect(subscriptionInvokeStub.firstCall.args[0]).to.equal(message);
    expect(subscriptionInvokeStub.firstCall.args[1]).to.equal(peerId);
  });

  it("should successfully stop", async () => {
    const contentTopic2 = "/test/1/waku-filter-2/utf8";
    const decoder2 = createDecoder(
      contentTopic2,
      createRoutingInfo(testNetworkconfig, { contentTopic: contentTopic2 })
    );
    const stopStub = sinon.stub(Subscription.prototype, "stop");

    sinon.stub(Subscription.prototype, "add").resolves(true);
    sinon.stub(Subscription.prototype, "start");

    await filter.subscribe(decoder, callback);
    await filter.subscribe(decoder2, callback);

    filter.unsubscribeAll();

    expect(stopStub.calledOnce).to.be.true;

    const result = await filter.unsubscribe(decoder);
    expect(result).to.be.false;
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
    isTopicConfigured: sinon.stub().callsFake((topic: string) => {
      return topic === testPubsubTopic;
    })
  } as unknown as ConnectionManager;
}

function mockPeerManager(): PeerManager {
  return {
    getPeers: sinon.stub().returns([]),
    events: {
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub()
    }
  } as unknown as PeerManager;
}

type MockFilterOptions = {
  libp2p: Libp2p;
  connectionManager?: ConnectionManager;
  peerManager?: PeerManager;
};

function mockFilter(options: MockFilterOptions): Filter {
  // we're not actually testing FilterCore functionality here
  return new Filter({
    libp2p: options.libp2p,
    peerManager: options.peerManager || mockPeerManager(),
    options: {
      numPeersToUse: 2,
      pingsBeforePeerRenewed: 3,
      keepAliveIntervalMs: 60_000
    }
  });
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
