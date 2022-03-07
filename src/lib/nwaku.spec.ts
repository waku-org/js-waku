import { expect } from "chai";
import { Multiaddr } from "multiaddr";
import PeerId from "peer-id";

import { fleets } from "./discovery/predefined";
import { Waku } from "./waku";

describe("Test nwaku test fleet", () => {
  const wakus: Waku[] = [];

  afterEach(function () {
    wakus.forEach((waku) => {
      waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });
  });

  it("Connect", async function () {
    // This test depends on fleets.status.im being online.
    // This dependence must be removed once DNS discovery is implemented
    this.timeout(20_000);

    const nodes = Object.values(fleets.fleets["wakuv2.test"]["waku-websocket"]);

    const peerIds = nodes.map((a) => {
      const ma = new Multiaddr(a);
      return ma.getPeerId()!;
    });

    expect(nodes.length).to.eq(3);

    const promises = nodes.map(async (node, i) => {
      wakus[i] = await Waku.create({
        bootstrap: { peers: [node] },
      });

      return new Promise((resolve) => {
        wakus[i].libp2p.connectionManager.on("peer:connect", (connection) => {
          resolve(connection.remotePeer);
        });
      }).then((connectedPeerID) => {
        const peerId = connectedPeerID as unknown as PeerId;
        expect(peerId.toB58String()).to.eq(peerIds[i]);
      });
    });

    await Promise.all(promises);
  });
});
