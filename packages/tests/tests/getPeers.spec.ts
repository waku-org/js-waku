import type { Connection } from "@libp2p/interface/connection";
import type { PeerStore } from "@libp2p/interface/peer-store";
import type { Peer } from "@libp2p/interface/peer-store";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import {
  createLightNode,
  Libp2pComponents,
  type LightNode,
  Tags,
  utf8ToBytes
} from "@waku/sdk";
import { expect } from "chai";
import fc from "fast-check";
import Sinon from "sinon";

describe("getPeers", function () {
  let peerStore: PeerStore;
  let connectionManager: Libp2pComponents["connectionManager"];
  let waku: LightNode;
  const lowPingBytes = utf8ToBytes("50");
  const midPingBytes = utf8ToBytes("100");
  const highPingBytes = utf8ToBytes("200");

  let lowPingBootstrapPeer: Peer,
    lowPingNonBootstrapPeer: Peer,
    midPingBootstrapPeer: Peer,
    midPingNonBootstrapPeer: Peer,
    highPingBootstrapPeer: Peer,
    highPingNonBootstrapPeer: Peer,
    differentCodecPeer: Peer,
    anotherDifferentCodecPeer: Peer;

  let bootstrapPeers: Peer[];
  let nonBootstrapPeers: Peer[];
  let allPeers: Peer[];

  beforeEach(async function () {
    this.timeout(10_000);
    waku = await createLightNode();
    peerStore = waku.libp2p.peerStore;
    connectionManager = waku.libp2p.components.connectionManager;

    const [
      lowPingBootstrapPeerId,
      lowPingNonBootstrapPeerId,
      midPingBootstrapPeerId,
      midPingNonBootstrapPeerId,
      highPingBootstrapPeerId,
      highPingNonBootstrapPeerId,
      differentCodecPeerId,
      anotherDifferentCodecPeerId
    ] = await Promise.all([
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId(),
      createSecp256k1PeerId()
    ]);

    lowPingBootstrapPeer = {
      id: lowPingBootstrapPeerId,
      protocols: [waku.lightPush.multicodec],
      metadata: new Map().set("ping", lowPingBytes),
      tags: new Map().set(Tags.BOOTSTRAP, {})
    } as Peer;
    lowPingNonBootstrapPeer = {
      id: lowPingNonBootstrapPeerId,
      protocols: [waku.lightPush.multicodec],
      metadata: new Map().set("ping", lowPingBytes),
      tags: new Map().set(Tags.PEER_EXCHANGE, {})
    } as Peer;
    midPingBootstrapPeer = {
      id: midPingBootstrapPeerId,
      protocols: [waku.lightPush.multicodec],
      metadata: new Map().set("ping", midPingBytes),
      tags: new Map().set(Tags.BOOTSTRAP, {})
    } as Peer;
    midPingNonBootstrapPeer = {
      id: midPingNonBootstrapPeerId,
      protocols: [waku.lightPush.multicodec],
      metadata: new Map().set("ping", midPingBytes),
      tags: new Map().set(Tags.PEER_EXCHANGE, {})
    } as Peer;
    highPingBootstrapPeer = {
      id: highPingBootstrapPeerId,
      protocols: [waku.lightPush.multicodec],
      metadata: new Map().set("ping", highPingBytes),
      tags: new Map().set(Tags.BOOTSTRAP, {})
    } as Peer;
    highPingNonBootstrapPeer = {
      id: highPingNonBootstrapPeerId,
      protocols: [waku.lightPush.multicodec],
      metadata: new Map().set("ping", highPingBytes),
      tags: new Map().set(Tags.PEER_EXCHANGE, {})
    } as Peer;
    differentCodecPeer = {
      id: differentCodecPeerId,
      protocols: ["different/1"],
      metadata: new Map().set("ping", lowPingBytes),
      tags: new Map().set(Tags.BOOTSTRAP, {})
    } as Peer;
    anotherDifferentCodecPeer = {
      id: anotherDifferentCodecPeerId,
      protocols: ["different/2"],
      metadata: new Map().set("ping", lowPingBytes),
      tags: new Map().set(Tags.BOOTSTRAP, {})
    } as Peer;

    bootstrapPeers = [
      lowPingBootstrapPeer,
      midPingBootstrapPeer,
      highPingBootstrapPeer
    ];

    nonBootstrapPeers = [
      lowPingNonBootstrapPeer,
      midPingNonBootstrapPeer,
      highPingNonBootstrapPeer
    ];

    allPeers = [
      ...bootstrapPeers,
      ...nonBootstrapPeers,
      differentCodecPeer,
      anotherDifferentCodecPeer
    ];

    Sinon.stub(peerStore, "get").callsFake(async (peerId) => {
      return allPeers.find((peer) => peer.id.equals(peerId))!;
    });

    Sinon.stub(peerStore, "forEach").callsFake(async (callback) => {
      for (const peer of allPeers) {
        callback(peer);
      }
    });

    // assume all peers have an opened connection
    Sinon.stub(connectionManager, "getConnections").callsFake(() => {
      const connections: Connection[] = [];
      for (const peer of allPeers) {
        connections.push({
          status: "open",
          remotePeer: peer.id
        } as unknown as Connection);
      }
      return connections;
    });
  });

  this.afterEach(function () {
    Sinon.restore();
  });

  describe("getPeers with varying maxBootstrapPeers", function () {
    const maxBootstrapPeersValues = [1, 2, 3, 4, 5, 6, 7];

    maxBootstrapPeersValues.forEach((maxBootstrapPeers) => {
      describe(`maxBootstrapPeers=${maxBootstrapPeers}`, function () {
        it(`numPeers=1 -- returns one bootstrap peer `, async function () {
          const result = (await (waku.lightPush as any).getPeers({
            numPeers: 1,
            maxBootstrapPeers
          })) as Peer[];

          // Should only have 1 peer
          expect(result).to.have.lengthOf(1);

          // The peer should be a bootstrap peer
          expect(result[0].tags.has(Tags.BOOTSTRAP)).to.be.true;

          // Peer should be of the same protocol
          expect(result[0].protocols.includes(waku.lightPush.multicodec)).to.be
            .true;

          // Peer should have the lowest ping
          expect(result[0].metadata.get("ping")).to.equal(lowPingBytes);
        });

        it(`numPeers=2 -- returns total 2 peers, with max ${maxBootstrapPeers} bootstrap peers`, async function () {
          const result = (await (waku.lightPush as any).getPeers({
            numPeers: 2,
            maxBootstrapPeers
          })) as Peer[];

          // Should only have 2 peers
          expect(result).to.have.lengthOf(2);

          // Should only have ${maxBootstrapPeers} bootstrap peers
          expect(
            result.filter((peer: Peer) => peer.tags.has(Tags.BOOTSTRAP)).length
          ).to.be.lessThanOrEqual(maxBootstrapPeers);

          // Should return peers with the same protocol
          expect(
            result.every((peer: Peer) =>
              peer.protocols.includes(waku.lightPush.multicodec)
            )
          ).to.be.true;

          // All peers should be sorted by latency
          // 0th index should be the lowest ping of all peers returned
          expect(result[0].metadata.get("ping")).to.equal(lowPingBytes);
        });

        it(`numPeers=3 -- returns total 3 peers, with max ${maxBootstrapPeers} bootstrap peers`, async function () {
          const result = (await (waku.lightPush as any).getPeers({
            numPeers: 3,
            maxBootstrapPeers
          })) as Peer[];

          // Should only have 3 peers
          expect(result).to.have.lengthOf(3);

          // Should only have ${maxBootstrapPeers} bootstrap peers
          expect(
            result.filter((peer: Peer) => peer.tags.has(Tags.BOOTSTRAP)).length
          ).to.be.lessThanOrEqual(maxBootstrapPeers);

          // Should return peers with the same protocol
          expect(
            result.every((peer: Peer) =>
              peer.protocols.includes(waku.lightPush.multicodec)
            )
          ).to.be.true;

          // All peers should be sorted by latency
          // 0th index should be the lowest ping of all peers returned
          expect(result[0].metadata.get("ping")).to.equal(lowPingBytes);
        });

        it(`numPeers=4 -- returns total 4 peers, with max ${maxBootstrapPeers} bootstrap peers`, async function () {
          const result = (await (waku.lightPush as any).getPeers({
            numPeers: 4,
            maxBootstrapPeers
          })) as Peer[];

          // Should only have 4 peers
          expect(result).to.have.lengthOf(4);

          // Should only have ${maxBootstrapPeers} bootstrap peers
          expect(
            result.filter((peer: Peer) => peer.tags.has(Tags.BOOTSTRAP)).length
          ).to.be.lessThanOrEqual(maxBootstrapPeers);

          // Should return peers with the same protocol
          expect(
            result.every((peer: Peer) =>
              peer.protocols.includes(waku.lightPush.multicodec)
            )
          ).to.be.true;

          // All peers should be sorted by latency
          // 0th index should be the lowest ping of all peers returned
          expect(result[0].metadata.get("ping")).to.equal(lowPingBytes);
        });

        it(`numPeers=0 -- returns all peers including all non-bootstrap with maxBootstrapPeers: ${maxBootstrapPeers}`, async function () {
          const result = (await (waku.lightPush as any).getPeers({
            numPeers: 0,
            maxBootstrapPeers
          })) as Peer[];

          // Should have all non-bootstrap peers + ${maxBootstrapPeers} bootstrap peers
          // Unless bootstrapPeers.length < maxBootstrapPeers
          // Then it should be all non-bootstrap peers + bootstrapPeers.length
          if (maxBootstrapPeers > bootstrapPeers.length) {
            expect(result).to.have.lengthOf(
              nonBootstrapPeers.length + bootstrapPeers.length
            );
          } else {
            expect(result).to.have.lengthOf(
              nonBootstrapPeers.length + maxBootstrapPeers
            );
          }

          // All peers should be bootstrap peers
          expect(
            result.filter((peer: Peer) => peer.tags.has(Tags.BOOTSTRAP)).length
          ).to.be.lessThanOrEqual(maxBootstrapPeers);

          // Peers should be of the same protocol
          expect(
            result.every((peer: Peer) =>
              peer.protocols.includes(waku.lightPush.multicodec)
            )
          ).to.be.true;

          // All peers returned should be sorted by latency
          // 0th index should be the lowest ping of all peers returned
          expect(result[0].metadata.get("ping")).to.equal(lowPingBytes);
        });
      });
    });
  });

  describe("getPeers property-based tests", function () {
    it("should return the correct number of peers based on numPeers and maxBootstrapPeers", async function () {
      await fc.assert(
        fc.asyncProperty(
          //max bootstrap peers
          fc.integer({ min: 1, max: 100 }),
          //numPeers
          fc.integer({ min: 0, max: 100 }),
          async (maxBootstrapPeers, numPeers) => {
            const result = (await (waku.lightPush as any).getPeers({
              numPeers,
              maxBootstrapPeers
            })) as Peer[];

            if (numPeers === 0) {
              // Expect all peers when numPeers is 0
              expect(result.length).to.be.greaterThanOrEqual(1);
            } else {
              // Expect up to numPeers peers
              expect(result.length).to.be.lessThanOrEqual(numPeers);
            }
          }
        ),
        {
          verbose: true
        }
      );
    });
  });
});
