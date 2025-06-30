import type { PeerId } from "@libp2p/interface";
import { FilterCore } from "@waku/core";
import type {
  FilterProtocolOptions,
  IDecodedMessage,
  IDecoder,
  Libp2p
} from "@waku/interfaces";
import { WakuMessage } from "@waku/proto";
import { expect } from "chai";
import sinon from "sinon";

import { NewPeerManager } from "../peer_manager/index.js";

import { Subscription } from "./subscription.js";

const PUBSUB_TOPIC = "/waku/2/rs/1/4";
const CONTENT_TOPIC = "/test/1/waku-filter/utf8";

describe("Filter Subscription", () => {
  let libp2p: Libp2p;
  let filterCore: FilterCore;
  let peerManager: NewPeerManager;
  let subscription: Subscription;
  let decoder: IDecoder<IDecodedMessage>;
  let config: FilterProtocolOptions;

  beforeEach(() => {
    libp2p = mockLibp2p();
    filterCore = mockFilterCore();
    peerManager = mockPeerManager();
    config = {
      numPeersToUse: 2,
      pingsBeforePeerRenewed: 3,
      keepAliveIntervalMs: 60_000
    };

    subscription = new Subscription({
      pubsubTopic: PUBSUB_TOPIC,
      libp2p,
      protocol: filterCore,
      config,
      peerManager
    });

    decoder = mockDecoder();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should be empty when created", () => {
    expect(subscription.isEmpty()).to.be.true;
  });

  it("should not be empty after adding a subscription", async () => {
    const attemptSubscribeSpy = sinon
      .stub(subscription as any, "attemptSubscribe")
      .resolves(true);

    const callback = sinon.spy();
    await subscription.add(decoder, callback);

    expect(subscription.isEmpty()).to.be.false;
    expect(attemptSubscribeSpy.calledOnce).to.be.true;
  });

  it("should be empty after removing the only subscription", async () => {
    const attemptSubscribeSpy = sinon
      .stub(subscription as any, "attemptSubscribe")
      .resolves(true);
    const attemptUnsubscribeSpy = sinon
      .stub(subscription as any, "attemptUnsubscribe")
      .resolves(true);

    const callback = sinon.spy();
    await subscription.add(decoder, callback);
    await subscription.remove(decoder);

    expect(subscription.isEmpty()).to.be.true;
    expect(attemptSubscribeSpy.calledOnce).to.be.true;
    expect(attemptUnsubscribeSpy.calledOnce).to.be.true;
  });

  it("should invoke callbacks when receiving a message", async () => {
    const testContentTopic = "/custom/content/topic";
    const testDecoder = {
      pubsubTopic: PUBSUB_TOPIC,
      contentTopic: testContentTopic,
      fromProtoObj: sinon.stub().callsFake(() => {
        return Promise.resolve({ payload: new Uint8Array([1, 2, 3]) });
      })
    };

    const callback = sinon.spy();
    const message = {
      contentTopic: testContentTopic
    } as WakuMessage;

    sinon.stub(subscription as any, "attemptSubscribe").resolves(true);
    await subscription.add(testDecoder as any, callback);

    subscription.invoke(message, "peer1");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callback.called).to.be.true;
    expect(testDecoder.fromProtoObj.called).to.be.true;
    expect(callback.callCount).to.eq(1);
  });

  it("should invoke callbacks only when newly receiving message is given", async () => {
    const testContentTopic = "/custom/content/topic";
    const testDecoder = {
      pubsubTopic: PUBSUB_TOPIC,
      contentTopic: testContentTopic,
      fromProtoObj: sinon.stub().callsFake(() => {
        return Promise.resolve({ payload: new Uint8Array([1, 2, 3]) });
      })
    };

    const callback = sinon.spy();
    const message = {
      contentTopic: testContentTopic
    } as WakuMessage;

    sinon.stub(subscription as any, "attemptSubscribe").resolves(true);
    await subscription.add(testDecoder as any, callback);

    subscription.invoke(message, "peer1");
    await new Promise((resolve) => setTimeout(resolve, 50));

    subscription.invoke(message, "peer2");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callback.called).to.be.true;
    expect(testDecoder.fromProtoObj.called).to.be.true;
    expect(callback.callCount).to.eq(1);
  });

  it("should start and setup intervals and event listeners", () => {
    const attemptSubscribeSpy = sinon
      .stub(subscription as any, "attemptSubscribe")
      .resolves(true);
    const setupSubscriptionIntervalSpy = sinon.spy(
      subscription as any,
      "setupSubscriptionInterval"
    );
    const setupKeepAliveIntervalSpy = sinon.spy(
      subscription as any,
      "setupKeepAliveInterval"
    );
    const setupEventListenersSpy = sinon.spy(
      subscription as any,
      "setupEventListeners"
    );

    subscription.start();

    expect(attemptSubscribeSpy.calledOnce).to.be.true;
    expect(setupSubscriptionIntervalSpy.calledOnce).to.be.true;
    expect(setupKeepAliveIntervalSpy.calledOnce).to.be.true;
    expect(setupEventListenersSpy.calledOnce).to.be.true;
  });

  it("should stop and cleanup resources", () => {
    const disposeEventListenersSpy = sinon.spy(
      subscription as any,
      "disposeEventListeners"
    );
    const disposeIntervalsSpy = sinon.spy(
      subscription as any,
      "disposeIntervals"
    );
    const disposePeersSpy = sinon
      .stub(subscription as any, "disposePeers")
      .resolves();
    const disposeHandlersSpy = sinon.spy(
      subscription as any,
      "disposeHandlers"
    );

    sinon.stub(subscription as any, "attemptSubscribe").resolves(true);
    subscription.start();

    subscription.stop();

    expect(disposeEventListenersSpy.calledOnce).to.be.true;
    expect(disposeIntervalsSpy.calledOnce).to.be.true;
    expect(disposePeersSpy.calledOnce).to.be.true;
    expect(disposeHandlersSpy.calledOnce).to.be.true;
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

function mockFilterCore(): FilterCore {
  return {
    subscribe: sinon.stub().resolves(true),
    unsubscribe: sinon.stub().resolves(true),
    ping: sinon.stub().resolves(true)
  } as unknown as FilterCore;
}

function mockPeerManager(): NewPeerManager {
  return {
    getPeers: sinon.stub().resolves([mockPeerId("peer1"), mockPeerId("peer2")])
  } as unknown as NewPeerManager;
}

function mockPeerId(id: string): PeerId {
  return {
    toString: () => id
  } as unknown as PeerId;
}

function mockDecoder(): IDecoder<IDecodedMessage> {
  return {
    pubsubTopic: PUBSUB_TOPIC,
    contentTopic: CONTENT_TOPIC,
    fromProtoObj: sinon.stub().resolves(undefined)
  } as unknown as IDecoder<IDecodedMessage>;
}
