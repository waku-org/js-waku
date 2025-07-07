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
import sinon, { SinonSpy } from "sinon";

import { PeerManager } from "../peer_manager/index.js";

import { LightPush } from "./light_push.js";

const CLUSTER_ID = 1;
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
    const failures = result.failures ?? [];

    expect(failures.length).to.be.eq(1);
    expect(failures.some((v) => v.error === ProtocolError.TOPIC_NOT_CONFIGURED))
      .to.be.true;
  });

  it("should fail to send if no connected peers found", async () => {
    const result = await lightPush.send(encoder, {
      payload: utf8ToBytes("test")
    });
    const failures = result.failures ?? [];

    expect(failures.length).to.be.eq(1);
    expect(failures.some((v) => v.error === ProtocolError.NO_PEER_AVAILABLE)).to
      .be.true;
  });

  it("should send to specified number of peers of used peers", async () => {
    libp2p = mockLibp2p({
      peers: [mockPeer("1"), mockPeer("2"), mockPeer("3"), mockPeer("4")]
    });

    lightPush = mockLightPush({ libp2p, numPeersToUse: 2 });
    let sendSpy = sinon.spy(
      (_encoder: any, _message: any, peerId: PeerId) =>
        Promise.resolve({ success: peerId }) as any
    );
    lightPush["protocol"].send = sendSpy;

    let result = await lightPush.send(encoder, {
      payload: utf8ToBytes("test")
    });

    expect(sendSpy.calledTwice, "1").to.be.true;
    expect(result.successes?.length, "2").to.be.eq(2);

    // check if setting another value works
    lightPush = mockLightPush({ libp2p, numPeersToUse: 3 });
    sendSpy = sinon.spy(
      (_encoder: any, _message: any, peerId: PeerId) =>
        Promise.resolve({ success: peerId }) as any
    );
    lightPush["protocol"].send = sendSpy;

    result = await lightPush.send(encoder, { payload: utf8ToBytes("test") });

    expect(sendSpy.calledThrice, "3").to.be.true;
    expect(result.successes?.length, "4").to.be.eq(3);
  });

  it("should retry on complete failure if specified", async () => {
    libp2p = mockLibp2p({
      peers: [mockPeer("1"), mockPeer("2")]
    });

    lightPush = mockLightPush({ libp2p });
    const sendSpy = sinon.spy((_encoder: any, _message: any, _peerId: PeerId) =>
      Promise.resolve({ failure: { error: "problem" } })
    );
    lightPush["protocol"].send = sendSpy as any;

    const retryPushSpy = (lightPush as any)["retryManager"].push as SinonSpy;
    const result = await lightPush.send(
      encoder,
      { payload: utf8ToBytes("test") },
      { autoRetry: true }
    );

    expect(retryPushSpy.callCount).to.be.eq(1);
    expect(result.failures?.length).to.be.eq(2);
  });

  it("should not retry if at least one success", async () => {
    libp2p = mockLibp2p({
      peers: [mockPeer("1"), mockPeer("2")]
    });

    lightPush = mockLightPush({ libp2p });
    const sendSpy = sinon.spy(
      (_encoder: any, _message: any, peerId: PeerId) => {
        if (peerId.toString() === "1") {
          return Promise.resolve({ success: peerId });
        }

        return Promise.resolve({ failure: { error: "problem" } });
      }
    );
    lightPush["protocol"].send = sendSpy as any;
    const retryPushSpy = (lightPush as any)["retryManager"].push as SinonSpy;

    const result = await lightPush.send(
      encoder,
      { payload: utf8ToBytes("test") },
      { autoRetry: true }
    );

    expect(retryPushSpy.callCount).to.be.eq(0);
    expect(result.successes?.length).to.be.eq(1);
    expect(result.failures?.length).to.be.eq(1);
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
  numPeersToUse?: number;
};

function mockLightPush(options: MockLightPushOptions): LightPush {
  const lightPush = new LightPush({
    clusterId: CLUSTER_ID,
    connectionManager: {
      pubsubTopics: options.pubsubTopics || [PUBSUB_TOPIC]
    } as ConnectionManager,
    peerManager: {
      getPeers: () =>
        options.libp2p
          .getPeers()
          .slice(0, options.numPeersToUse || options.libp2p.getPeers().length)
    } as unknown as PeerManager,
    libp2p: options.libp2p,
    options: {
      numPeersToUse: options.numPeersToUse
    }
  });

  (lightPush as any)["retryManager"] = {
    push: sinon.spy()
  };

  return lightPush;
}

function mockPeer(id: string): Peer {
  return {
    id,
    protocols: [LightPushCodec]
  } as unknown as Peer;
}
