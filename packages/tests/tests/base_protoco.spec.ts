import { Peer } from "@libp2p/interface/peer-store";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import { LightNode, Tags } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import * as libp2pUtils from "@waku/utils/libp2p";
import { expect } from "chai";
import Sinon, { SinonStub } from "sinon";

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
    getPeersForProtocolStub = Sinon.stub(libp2pUtils, "getPeersForProtocol");
  });

  afterEach(function () {
    Sinon.restore();
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
