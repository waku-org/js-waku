import type { PeerStore } from "@libp2p/interface/peer-store";
import type { Peer } from "@libp2p/interface/peer-store";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import {
  createDecoder,
  createEncoder,
  DefaultPubSubTopic,
  waitForRemotePeer
} from "@waku/core";
import { LightNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { toAsyncIterator } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { selectPeerForProtocol } from "@waku/utils/libp2p";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";

import { delay, makeLogFileName, NOISE_KEY_1 } from "../src/index.js";
import { NimGoNode } from "../src/node/node.js";

chai.use(chaiAsPromised);

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

    const { iterator } = await toAsyncIterator(waku.filter, TestDecoder, {
      timeoutMs: 1000
    });

    await waku.lightPush.send(TestEncoder, sent);
    const { value } = await iterator.next();

    expect(value.contentTopic).to.eq(TestContentTopic);
    expect(value.pubSubTopic).to.eq(DefaultPubSubTopic);
    expect(bytesToUtf8(value.payload)).to.eq(messageText);
  });

  it("handles multiple messages", async function () {
    this.timeout(10000);
    const { iterator } = await toAsyncIterator(waku.filter, TestDecoder, {
      timeoutMs: 1000
    });

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
    const { iterator, stop } = await toAsyncIterator(waku.filter, TestDecoder, {
      timeoutMs: 1000
    });

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
  const protocols = [TestCodec];

  let lowPingPeer: Peer,
    midPingPeer: Peer,
    highPingPeer: Peer,
    differentCodecPeer: Peer,
    anotherDifferentCodecPeer: Peer;

  beforeEach(async function () {
    this.timeout(10000);
    const waku = await createLightNode();
    await waku.start();
    await delay(3000);
    peerStore = waku.libp2p.peerStore;

    const [
      lowPingPeerId,
      midPingPeerId,
      highPingPeerId,
      differentCodecPeerId,
      anotherDifferentCodecPeerId
    ] = await Promise.all([
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId()
    ]);

    lowPingPeer = {
      id: lowPingPeerId,
      protocols: [TestCodec],
      metadata: new Map().set("ping", utf8ToBytes("50"))
    } as Peer;

    midPingPeer = {
      id: midPingPeerId,
      protocols: [TestCodec],
      metadata: new Map().set("ping", utf8ToBytes("100"))
    } as Peer;

    highPingPeer = {
      id: highPingPeerId,
      protocols: [TestCodec],
      metadata: new Map().set("ping", utf8ToBytes("500"))
    } as Peer;

    differentCodecPeer = {
      id: differentCodecPeerId,
      protocols: ["DifferentCodec"]
    } as Peer;

    anotherDifferentCodecPeer = {
      id: anotherDifferentCodecPeerId,
      protocols: ["AnotherDifferentCodec"]
    } as Peer;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should return the peer with the lowest ping", async function () {
    const mockPeers = [highPingPeer, lowPingPeer, midPingPeer];

    sinon.stub(peerStore, "get").callsFake(async (peerId) => {
      return mockPeers.find((peer) => peer.id.equals(peerId))!;
    });

    sinon.stub(peerStore, "forEach").callsFake(async (callback) => {
      for (const peer of mockPeers) {
        callback(peer);
      }
    });

    const result = await selectPeerForProtocol(peerStore, protocols);

    expect(result.peer).to.deep.equal(lowPingPeer);
    expect(result.protocol).to.equal(TestCodec);
  });

  it("should return the peer with the provided peerId", async function () {
    const targetPeer = await createSecp256k1PeerId();
    const mockPeer = { id: targetPeer, protocols: [TestCodec] } as Peer;
    sinon.stub(peerStore, "get").withArgs(targetPeer).resolves(mockPeer);

    const result = await selectPeerForProtocol(
      peerStore,
      protocols,
      targetPeer
    );
    expect(result.peer).to.deep.equal(mockPeer);
  });

  it("should return a random peer when all peers have the same latency", async function () {
    const mockPeers = [highPingPeer, highPingPeer, highPingPeer];

    sinon.stub(peerStore, "get").callsFake(async (peerId) => {
      return mockPeers.find((peer) => peer.id.equals(peerId))!;
    });

    sinon.stub(peerStore, "forEach").callsFake(async (callback) => {
      for (const peer of mockPeers) {
        callback(peer);
      }
    });

    const result = await selectPeerForProtocol(peerStore, protocols);

    expect(mockPeers).to.deep.include(result.peer);
  });

  it("should throw an error when no peer matches the given protocols", async function () {
    const mockPeers = [differentCodecPeer, anotherDifferentCodecPeer];

    sinon.stub(peerStore, "forEach").callsFake(async (callback) => {
      for (const peer of mockPeers) {
        callback(peer);
      }
    });

    await expect(
      selectPeerForProtocol(peerStore, protocols)
    ).to.be.rejectedWith(
      `Failed to find known peer that registers protocols: ${protocols}`
    );
  });

  it("should throw an error when the selected peer does not register the required protocols", async function () {
    const targetPeer = await createSecp256k1PeerId();
    const mockPeer = { id: targetPeer, protocols: ["DifferentCodec"] } as Peer;
    sinon.stub(peerStore, "get").withArgs(targetPeer).resolves(mockPeer);

    await expect(
      selectPeerForProtocol(peerStore, protocols, targetPeer)
    ).to.be.rejectedWith(
      `Peer does not register required protocols (${targetPeer.toString()}): ${protocols}`
    );
  });
});
