import { expect } from "chai";
import PeerId from "peer-id";

import { Waku } from "./waku";

describe("Waku Dial", function () {
  describe("Bootstrap [live data]", function () {
    let waku: Waku;

    afterEach(function () {
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    before(function () {
      if (process.env.CI) {
        this.skip();
      }
    });

    it("Enabling default [live data]", async function () {
      // This test depends on fleets.status.im being online.
      // This dependence must be removed once DNS discovery is implemented
      this.timeout(20_000);

      waku = await Waku.create({
        bootstrap: { default: true },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on("peer:connect", (connection) => {
          resolve(connection.remotePeer);
        });
      });

      expect(connectedPeerID).to.not.be.undefined;
    });
  });
});
