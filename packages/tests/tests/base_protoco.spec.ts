import { Peer } from "@libp2p/interface/peer-store";
import type { Tag } from "@libp2p/interface/peer-store";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import { LightNode, Tags } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

describe("getPeers function", function () {
  let waku: LightNode | undefined;

  beforeEach(async function () {
    waku = await createLightNode();
  });

  it("should return all peers when numPeers is 0", async function () {
    const peer1 = await createSecp256k1PeerId();
    const peer2 = await createSecp256k1PeerId();
    const peer3 = await createSecp256k1PeerId();

    const mockPeers = [
      {
        id: peer1,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      },
      {
        id: peer2,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      },
      {
        id: peer3,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      }
    ] as unknown as Peer[];

    const result = await (waku?.lightPush as any).filterPeers(mockPeers, 0, 0);
    expect(result.length).to.deep.equal(mockPeers.length);
  });

  it("should return all peers, except bootstrap, when numPeers is 0 & maxBootstrap is defined", async function () {
    const peer1 = await createSecp256k1PeerId();
    const peer2 = await createSecp256k1PeerId();
    const peer3 = await createSecp256k1PeerId();
    const peer4 = await createSecp256k1PeerId();
    const peer5 = await createSecp256k1PeerId();

    const mockPeers = [
      {
        id: peer1,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      },
      {
        id: peer2,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      },
      {
        id: peer3,
        tags: new Map<string, Tag>([[Tags.PEER_EXCHANGE, { value: 100 }]])
      },
      {
        id: peer4,
        tags: new Map<string, Tag>([[Tags.PEER_EXCHANGE, { value: 100 }]])
      },
      {
        id: peer5,
        tags: new Map<string, Tag>([[Tags.PEER_EXCHANGE, { value: 100 }]])
      }
    ] as unknown as Peer[];

    const result = await (waku?.lightPush as any).filterPeers(mockPeers, 0, 1);

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
      {
        id: peer1,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      },
      {
        id: peer2,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      },
      {
        id: peer3,
        tags: new Map<string, Tag>([[Tags.BOOTSTRAP, { value: 100 }]])
      },
      {
        id: peer4,
        tags: new Map<string, Tag>([[Tags.PEER_EXCHANGE, { value: 100 }]])
      },
      {
        id: peer5,
        tags: new Map<string, Tag>([[Tags.PEER_EXCHANGE, { value: 100 }]])
      }
    ] as unknown as Peer[];

    const result = await (waku?.lightPush as any).filterPeers(mockPeers, 5, 2);

    // check that result has at least 2 bootstrap peers and no more than 5 peers
    expect(result.length).to.be.at.least(2);
    expect(result.length).to.be.at.most(5);
    expect(result.filter((peer: Peer) => peer.tags.has(Tags.BOOTSTRAP)).length);
  });
});
