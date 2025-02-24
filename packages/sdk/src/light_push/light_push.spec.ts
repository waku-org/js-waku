import { Peer, PeerId } from "@libp2p/interface";
import {
  ConnectionManager,
  createEncoder,
  Encoder,
  LightPushCodec
} from "@waku/core";
import { Libp2p, ProtocolError } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import sinon from "sinon";

import { PeerManager } from "../peer_manager/index.js";

import { LightPush } from "./light_push.js";

const PUBSUB_TOPIC = "/waku/2/rs/1/4";
const CONTENT_TOPIC = "/test/1/waku-light-push/utf8";

describe("LightPush SDK", () => {
  let libp2p: Libp2p;
  let encoder: Encoder;
  let lightPush: LightPush;

  beforeEach(() => {
    libp2p = mockLibp2p();
    encoder = createEncoder({ contentTopic: CONTENT_TOPIC });
    lightPush = mockLightPush({ libp2p });
  });

  it("should fail to send if pubsub topics are misconfigured", async () => {
    lightPush = mockLightPush({ libp2p, pubsubTopics: ["/wrong"] });

    const result = await lightPush.send(encoder, {
      payload: utf8ToBytes("test")
    });

    expect(result.failure?.error).to.be.eq(ProtocolError.TOPIC_NOT_CONFIGURED);
  });

  it("should fail to send if no connected peers found", async () => {
    const result = await lightPush.send(encoder, {
      payload: utf8ToBytes("test")
    });

    expect(result.failure?.error).to.be.eq(ProtocolError.NO_PEER_AVAILABLE);
  });

  it("should send to available peer", async () => {
    libp2p = mockLibp2p({
      peers: [mockPeer("1"), mockPeer("2")]
    });

    lightPush = mockLightPush({ libp2p });
    let sendSpy = sinon.spy(
      (_encoder: any, _message: any, peerId: PeerId) =>
        ({ success: peerId }) as any
    );
    lightPush.protocol.send = sendSpy;

    let result = await lightPush.send(encoder, {
      payload: utf8ToBytes("test")
    });

    expect(sendSpy.calledOnce).to.be.true;
    expect(result.success?.toString()).to.be.eq("1");

    // check if setting another value works
    libp2p = mockLibp2p({
      peers: [mockPeer("2"), mockPeer("1")]
    });
    lightPush = mockLightPush({ libp2p });
    sendSpy = sinon.spy(
      (_encoder: any, _message: any, peerId: PeerId) =>
        ({ success: peerId }) as any
    );
    lightPush.protocol.send = sendSpy;

    result = await lightPush.send(encoder, { payload: utf8ToBytes("test") });

    expect(sendSpy.calledOnce).to.be.true;
    expect(result.success?.toString()).to.be.eq("2");
  });

  it("should retry on failure if specified", async () => {
    libp2p = mockLibp2p({
      peers: [mockPeer("2"), mockPeer("1")]
    });

    lightPush = mockLightPush({ libp2p });
    const sendSpy = sinon.spy(() => ({
      success: null,
      failure: { error: "problem" }
    })) as any;
    lightPush.protocol.send = sendSpy as any;

    const scheduleRetry = lightPush["retryManager"].push as sinon.SinonSpy;

    const result = await lightPush.send(
      encoder,
      { payload: utf8ToBytes("test") },
      { autoRetry: true }
    );

    expect(scheduleRetry.calledOnce, "called once").to.be.true;
    expect(result.success, "success not defined").to.be.eq(null);
    expect(result.failure?.error, "failure error equal").to.be.eq("problem");
  });
});

type MockLibp2pOptions = {
  peers?: Peer[];
};

function mockLibp2p(options?: MockLibp2pOptions): Libp2p {
  const peers = options?.peers || [];
  const peerStore = {
    get: (id: any) => Promise.resolve(peers.find((p) => p.id === id))
  };

  return {
    peerStore,
    getPeers: () => peers.map((p) => p.id),
    components: {
      events: new EventTarget(),
      connectionManager: {
        getConnections: () => []
      } as any,
      peerStore
    }
  } as unknown as Libp2p;
}

type MockLightPushOptions = {
  libp2p: Libp2p;
  pubsubTopics?: string[];
};

function mockLightPush(options: MockLightPushOptions): LightPush {
  const lightPush = new LightPush(
    {
      pubsubTopics: options.pubsubTopics || [PUBSUB_TOPIC]
    } as ConnectionManager,
    {
      getPeers: () => options.libp2p.getPeers()
    } as unknown as PeerManager,
    options.libp2p
  );

  (lightPush as any).retryManager = {
    push: sinon.spy(() => {})
  };

  return lightPush;
}

function mockPeer(id: string): Peer {
  return {
    id,
    protocols: [LightPushCodec]
  } as unknown as Peer;
}
