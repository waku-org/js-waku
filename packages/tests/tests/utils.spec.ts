import type { PeerStore } from "@libp2p/interface/peer-store";
import type { Peer } from "@libp2p/interface/peer-store";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import {
  createDecoder,
  createEncoder,
  DefaultPubSubTopic,
  KeepAliveManager,
  waitForRemotePeer
} from "@waku/core";
import { LightNode, Tags } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { toAsyncIterator } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { selectPeerForProtocol } from "@waku/utils/libp2p";
import * as libp2pUtils from "@waku/utils/libp2p";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";

chai.use(chaiAsPromised);

import { delay, makeLogFileName, NOISE_KEY_1 } from "../src/index.js";
import { NimGoNode } from "../src/node/node.js";

const TestContentTopic = "/test/1/waku-filter";
const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
const TestDecoder = createDecoder(TestContentTopic);

describe("Util: toAsyncIterator: Filter", () => {
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.start({ filter: true, lightpush: true, relay: true });
    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
  });

  afterEach(async () => {
    try {
      await nwaku.stop();
      await waku.stop();
    } catch (err) {
      console.log("Failed to stop", err);
    }
  });

  it("creates an iterator", async function () {
    this.timeout(10000);
    const messageText = "hey, what's up?";
    const sent = { payload: utf8ToBytes(messageText) };

    const { iterator } = await toAsyncIterator(
      waku.filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, sent);
    const { value } = await iterator.next();

    expect(value.contentTopic).to.eq(TestContentTopic);
    expect(value.pubSubTopic).to.eq(DefaultPubSubTopic);
    expect(bytesToUtf8(value.payload)).to.eq(messageText);
  });

  it("handles multiple messages", async function () {
    this.timeout(10000);
    const { iterator } = await toAsyncIterator(
      waku.filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering works!")
    });
    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("Filtering still works!")
    });

    let result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering works!");

    result = await iterator.next();
    expect(bytesToUtf8(result.value.payload)).to.eq("Filtering still works!");
  });

  it("unsubscribes", async function () {
    this.timeout(10000);
    const { iterator, stop } = await toAsyncIterator(
      waku.filter,
      TestDecoder,
      {},
      { timeoutMs: 1000 }
    );

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should be received")
    });

    await stop();

    await waku.lightPush.send(TestEncoder, {
      payload: utf8ToBytes("This should not be received")
    });

    let result = await iterator.next();
    expect(result.done).to.eq(true);
    expect(bytesToUtf8(result.value.payload)).to.eq("This should be received");

    result = await iterator.next();
    expect(result.value).to.eq(undefined);
    expect(result.done).to.eq(true);
  });
});

const TestCodec = "test/1";

describe("selectPeerForProtocol", () => {
  let peerStore: PeerStore;
  let getPingStub: sinon.SinonStub;
  const protocols = [TestCodec];

  beforeEach(async function () {
    this.timeout(10000);
    const waku = await createLightNode();
    await waku.start();
    await delay(3000);
    peerStore = waku.libp2p.peerStore;
    getPingStub = sinon.stub(KeepAliveManager.getInstance(), "getPing");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return the peer with the lowest ping", async function () {
    const peer1 = await createSecp256k1PeerId();
    const peer2 = await createSecp256k1PeerId();
    const peer3 = await createSecp256k1PeerId();

    const mockPeers = [
      { id: peer1, protocols: [TestCodec] },
      { id: peer2, protocols: [TestCodec] },
      { id: peer3, protocols: [TestCodec] }
    ] as Peer[];

    sinon.stub(peerStore, "forEach").callsFake(async (callback) => {
      for (const peer of mockPeers) {
        callback(peer);
      }
    });

    getPingStub.withArgs(peer1).resolves(500);
    getPingStub.withArgs(peer2).resolves(1000);
    getPingStub.withArgs(peer3).resolves(100);

    const result = await selectPeerForProtocol(
      peerStore,
      getPingStub,
      protocols
    );

    expect(result.peer).to.deep.equal(mockPeers[2]);
    expect(result.protocol).to.equal(TestCodec);
  });

  it("should return the peer with the provided peerId", async function () {
    const targetPeer = await createSecp256k1PeerId();
    const mockPeer = { id: targetPeer, protocols: [TestCodec] } as Peer;
    sinon.stub(peerStore, "get").withArgs(targetPeer).resolves(mockPeer);

    const result = await selectPeerForProtocol(
      peerStore,
      getPingStub,
      protocols,
      targetPeer
    );
    expect(result.peer).to.deep.equal(mockPeer);
  });

  it("should return a any peer when all peers have the same latency", async function () {
    const peer1 = await createSecp256k1PeerId();
    const peer2 = await createSecp256k1PeerId();
    const peer3 = await createSecp256k1PeerId();

    const mockPeers = [
      { id: peer1, protocols: [TestCodec] },
      { id: peer2, protocols: [TestCodec] },
      { id: peer3, protocols: [TestCodec] }
    ] as Peer[];

    sinon.stub(peerStore, "forEach").callsFake(async (callback) => {
      for (const peer of mockPeers) {
        callback(peer);
      }
    });

    getPingStub.resolves(500); // All peers have the same latency

    const result = await selectPeerForProtocol(
      peerStore,
      getPingStub,
      protocols
    );

    expect(mockPeers).to.deep.include(result.peer);
  });

  it("should throw an error when no peer matches the given protocols", async function () {
    const mockPeers = [
      { id: await createSecp256k1PeerId(), protocols: ["DifferentCodec"] },
      {
        id: await createSecp256k1PeerId(),
        protocols: ["AnotherDifferentCodec"]
      }
    ] as Peer[];

    sinon.stub(peerStore, "forEach").callsFake(async (callback) => {
      for (const peer of mockPeers) {
        callback(peer);
      }
    });

    await expect(
      selectPeerForProtocol(peerStore, getPingStub, protocols)
    ).to.be.rejectedWith(
      `Failed to find known peer that registers protocols: ${protocols}`
    );
  });

  it("should throw an error when the selected peer does not register the required protocols", async function () {
    const targetPeer = await createSecp256k1PeerId();
    const mockPeer = { id: targetPeer, protocols: ["DifferentCodec"] } as Peer;
    sinon.stub(peerStore, "get").withArgs(targetPeer).resolves(mockPeer);

    await expect(
      selectPeerForProtocol(peerStore, getPingStub, protocols, targetPeer)
    ).to.be.rejectedWith(
      `Peer does not register required protocols (${targetPeer.toString()}): ${protocols}`
    );
  });
});

// these tests are skipped until we can figure out how to mock the standalone functions
// sinon doesn't seem to work with the standalone functions
// some helper utilities like proxyquire and rewire were also tried, but they don't seem to work either
// possible solution is the upgrade to jest, which has better mocking capabilities
// https://github.com/waku-org/js-waku/issues/1144
describe.skip("getPeers function", function () {
  let getPeersForProtocolStub: SinonStub;
  let waku: LightNode | undefined;

  beforeEach(async function () {
    waku = await createLightNode();
    getPeersForProtocolStub = sinon.stub(libp2pUtils, "getPeersForProtocol");
  });

  afterEach(function () {
    sinon.restore();
  });

  it("should return all peers when numPeers is 0", async function () {
    const peer1 = await createSecp256k1PeerId();
    const peer2 = await createSecp256k1PeerId();
    const peer3 = await createSecp256k1PeerId();

    const mockPeers = [
      { id: peer1, tags: [Tags.BOOTSTRAP] },
      { id: peer2, tags: [Tags.BOOTSTRAP] },
      { id: peer3, tags: [Tags.BOOTSTRAP] }
    ] as unknown as Peer[];

    getPeersForProtocolStub.resolves(mockPeers);

    const result = await (waku?.lightPush as any).getPeers({
      numPeers: 0
    });
    expect(result).to.deep.equal(mockPeers);
  });

  it("should return all peers, except bootstrap, when numPeers is 0 & maxBootstrap is defined", async function () {
    const peer1 = await createSecp256k1PeerId();
    const peer2 = await createSecp256k1PeerId();
    const peer3 = await createSecp256k1PeerId();
    const peer4 = await createSecp256k1PeerId();
    const peer5 = await createSecp256k1PeerId();

    const mockPeers = [
      { id: peer1, tags: [Tags.BOOTSTRAP] },
      { id: peer2, tags: [Tags.BOOTSTRAP] },
      { id: peer3, tags: [Tags.PEER_EXCHANGE] },
      { id: peer4, tags: [Tags.PEER_EXCHANGE] },
      { id: peer5, tags: [Tags.PEER_EXCHANGE] }
    ] as unknown as Peer[];

    getPeersForProtocolStub.resolves(mockPeers);

    const result = await (waku?.lightPush as any).getPeers({
      numPeers: 0,
      maxBootstrap: 1
    });

    // result should have 1 bootstrap peers, and a total of 4 peers
    expect(result.length).to.equal(4);
    expect(
      result.filter((peer: Peer) => peer.tags.has(Tags.BOOTSTRAP)).length
    ).to.equal(1);
  });

  it("should return only bootstrap peers up to maxBootstrapPeers", async function () {
    const peer1 = await createSecp256k1PeerId();
    const peer2 = await createSecp256k1PeerId();
    const peer3 = await createSecp256k1PeerId();
    const peer4 = await createSecp256k1PeerId();
    const peer5 = await createSecp256k1PeerId();
    const mockPeers = [
      { id: peer1, tags: [Tags.BOOTSTRAP] },
      { id: peer2, tags: [Tags.BOOTSTRAP] },
      { id: peer3, tags: [Tags.BOOTSTRAP] },
      { id: peer4, tags: [Tags.PEER_EXCHANGE] },
      { id: peer5, tags: [Tags.PEER_EXCHANGE] }
    ] as unknown as Peer[];

    getPeersForProtocolStub.resolves(mockPeers);

    const result = await (waku?.lightPush as any).getPeers({
      numPeers: 5,
      maxBootstrapPeers: 2
    });

    // check that result has at least 2 bootstrap peers and no more than 5 peers
    expect(result.length).to.be.at.least(2);
    expect(result.length).to.be.at.most(5);
    expect(result.filter((peer: Peer) => peer.tags.has(Tags.BOOTSTRAP)).length);
  });
});
